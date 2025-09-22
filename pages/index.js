import { useState, useEffect } from "react";

export default function Home() {
  const [auditStatus, setAuditStatus] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [files, setFiles] = useState([]);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [auditSites, setAuditSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [showSitePreview, setShowSitePreview] = useState(false);
  const [uploadMode, setUploadMode] = useState('upload'); // 'upload' or 'select'

  // Load folders and audit sites on component mount
  useEffect(() => {
    loadFolders();
    loadAuditSites();
  }, []);

  const loadFolders = async () => {
    try {
      const response = await fetch('/api/files');
      const data = await response.json();
      setFolders(data.folders || []);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  const loadAuditSites = async () => {
    try {
      const response = await fetch('/api/audit-sites');
      const data = await response.json();
      setAuditSites(data.sites || []);
    } catch (error) {
      console.error('Failed to load audit sites:', error);
    }
  };

  const loadFiles = async (folderName) => {
    try {
      const response = await fetch(`/api/files?folder=${folderName}`);
      const data = await response.json();
      setFiles(data.files || []);
      setSelectedFolder(folderName);
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  const handleFileUpload = async (file) => {
    setIsRunning(true);
    setAuditStatus({ status: "uploading", message: "Uploading configuration file..." });

    try {
      const formData = new FormData();
      formData.append("config", file);

      const response = await fetch("/api/audit", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to start audit");
      }

      const { taskId } = await response.json();
      setAuditStatus({ status: "running", message: "Audit in progress...", taskId });
      
      // Poll for updates
      pollStatus(taskId);
    } catch (error) {
      setAuditStatus({ status: "error", message: error.message });
      setIsRunning(false);
    }
  };

  const handleSiteSelect = async (site) => {
    setSelectedSite(site);
    setShowSitePreview(true);
  };

  const handleSiteAudit = async (site) => {
    setIsRunning(true);
    setAuditStatus({ status: "uploading", message: `Loading configuration for ${site.displayName}...` });

    try {
      const response = await fetch(`/api/audit-sites/${site.filename}`);
      const configData = await response.json();

      if (!response.ok) {
        throw new Error("Failed to load site configuration");
      }

      // Send the config data directly to the audit API with config name
      const auditResponse = await fetch("/api/audit", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...configData,
          configName: site.name
        }),
      });

      if (!auditResponse.ok) {
        throw new Error("Failed to start audit");
      }

      const { taskId } = await auditResponse.json();
      setAuditStatus({ status: "running", message: "Audit in progress...", taskId });
      setShowSitePreview(false);
      
      // Poll for updates
      pollStatus(taskId);
    } catch (error) {
      setAuditStatus({ status: "error", message: error.message });
      setIsRunning(false);
    }
  };

  const pollStatus = async (taskId) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/audit?taskId=${taskId}`);
        const data = await response.json();
        
        setAuditStatus(data);
        
        if (data.status === "completed" || data.status === "error") {
          clearInterval(interval);
          setIsRunning(false);
          if (data.status === "completed") {
            // Reload folders when audit completes
            await loadFolders();
            // Switch to browse reports tab and select the new folder
            setShowFileBrowser(true);
            if (data.folderName) {
              // Select the newly created folder
              setTimeout(() => {
                loadFiles(data.folderName);
              }, 500);
            }
          }
        }
      } catch (error) {
        clearInterval(interval);
        setAuditStatus({ status: "error", message: "Failed to check status" });
        setIsRunning(false);
      }
    }, 2000);
  };

  const downloadFile = (fileName) => {
    const url = `/api/download?folder=${selectedFolder}&file=${encodeURIComponent(fileName)}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadZip = () => {
    const url = `/api/download-zip?folder=${selectedFolder}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedFolder}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteClick = (folderName) => {
    setFolderToDelete(folderName);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!folderToDelete) return;

    try {
      const response = await fetch(`/api/delete-folder?folder=${encodeURIComponent(folderToDelete)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete folder');
      }

      // Clear selected folder if it was deleted
      if (selectedFolder === folderToDelete) {
        setSelectedFolder(null);
        setFiles([]);
      }

      // Reload folders
      await loadFolders();
      
      // Close confirmation dialog
      setShowDeleteConfirm(false);
      setFolderToDelete(null);
      
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete folder: ' + error.message);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setFolderToDelete(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div style={{ 
      padding: "2rem", 
      textAlign: "center", 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white"
    }}>
      <h1 style={{ fontSize: "3rem", marginBottom: "1rem", textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}>
        Lighthouse Audit Tool
      </h1>
      
      <p style={{ fontSize: "1.2rem", marginBottom: "2rem", opacity: 0.9 }}>
        Upload a JSON configuration file or select from pre-configured sites to generate Lighthouse reports
      </p>

      {/* Navigation Tabs */}
      <div style={{ marginBottom: "2rem" }}>
        <button
          onClick={() => setShowFileBrowser(false)}
          style={{
            background: showFileBrowser ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.3)",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: "5px 0 0 5px",
            cursor: "pointer",
            fontSize: "1rem"
          }}
        >
          New Audit
        </button>
        <button
          onClick={() => {
            setShowFileBrowser(true);
            loadFolders();
          }}
          style={{
            background: showFileBrowser ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.2)",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: "0 5px 5px 0",
            cursor: "pointer",
            fontSize: "1rem"
          }}
        >
          Browse Reports
        </button>
      </div>

      {!showFileBrowser ? (
        // Upload/Select Section
        <div style={{ 
          maxWidth: "800px", 
          margin: "0 auto",
          background: "rgba(255,255,255,0.1)",
          padding: "2rem",
          borderRadius: "10px",
          backdropFilter: "blur(10px)"
        }}>
          {/* Mode Selection */}
          <div style={{ marginBottom: "2rem" }}>
            <button
              onClick={() => setUploadMode('upload')}
              style={{
                background: uploadMode === 'upload' ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: "5px 0 0 5px",
                cursor: "pointer",
                fontSize: "1rem"
              }}
            >
              📁 Upload Custom Config
            </button>
            <button
              onClick={() => setUploadMode('select')}
              style={{
                background: uploadMode === 'select' ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: "0 5px 5px 0",
                cursor: "pointer",
                fontSize: "1rem"
              }}
            >
              ⚡ Select Pre-configured Site
            </button>
          </div>

          {uploadMode === 'upload' ? (
            <FileUpload onFileUpload={handleFileUpload} disabled={isRunning} />
          ) : (
            <SiteSelector 
              sites={auditSites}
              onSiteSelect={handleSiteSelect}
              disabled={isRunning}
              formatDate={formatDate}
            />
          )}
        </div>
      ) : (
        // File Browser Section
        <div style={{ 
          maxWidth: "800px", 
          margin: "0 auto",
          background: "rgba(255,255,255,0.1)",
          padding: "2rem",
          borderRadius: "10px",
          backdropFilter: "blur(10px)"
        }}>
          <FileBrowser 
            folders={folders}
            files={files}
            selectedFolder={selectedFolder}
            onFolderSelect={loadFiles}
            onFileDownload={downloadFile}
            onZipDownload={downloadZip}
            onDeleteClick={handleDeleteClick}
            formatFileSize={formatFileSize}
            formatDate={formatDate}
          />
        </div>
      )}

      {auditStatus && !showFileBrowser && (
        <div style={{ 
          maxWidth: "600px", 
          margin: "2rem auto",
          background: "rgba(255,255,255,0.1)",
          padding: "2rem",
          borderRadius: "10px",
          backdropFilter: "blur(10px)"
        }}>
          <AuditProgress status={auditStatus} />
        </div>
      )}

      {/* Site Preview Modal */}
      {showSitePreview && selectedSite && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "white",
            color: "#333",
            padding: "2rem",
            borderRadius: "10px",
            maxWidth: "600px",
            width: "90%",
            maxHeight: "80vh",
            overflowY: "auto"
          }}>
            <h3 style={{ color: "#333", margin: "0 0 1rem 0" }}>Audit Configuration Preview</h3>
            <div style={{ marginBottom: "1rem" }}>
              <strong style={{ color: "#333" }}>Site:</strong> {selectedSite.displayName}
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <strong style={{ color: "#333" }}>Base URL:</strong> {selectedSite.base}
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <strong style={{ color: "#333" }}>Pages to audit:</strong> {selectedSite.pathCount} pages
            </div>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button
                onClick={() => setShowSitePreview(false)}
                style={{
                  background: "#6c757d",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontSize: "1rem"
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSiteAudit(selectedSite)}
                style={{
                  background: "#28a745",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontSize: "1rem"
                }}
              >
                Start Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "white",
            padding: "2rem",
            borderRadius: "10px",
            maxWidth: "400px",
            width: "90%",
            textAlign: "center"
          }}>
            <h3 style={{ color: "#dc3545", margin: "0 0 1rem 0" }}>⚠️ Delete Folder</h3>
            <p style={{ color: "#333", margin: "0 0 1.5rem 0" }}>
              Are you sure you want to delete the folder <strong>"{folderToDelete}"</strong>? 
              This action cannot be undone and will permanently delete all files in this folder.
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button
                onClick={cancelDelete}
                style={{
                  background: "#6c757d",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontSize: "1rem"
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  background: "#dc3545",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontSize: "1rem"
                }}
              >
                Delete Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Site Selector Component
function SiteSelector({ sites, onSiteSelect, disabled, formatDate }) {
  return (
    <div>
      <h3 style={{ color: "white", marginBottom: "1rem" }}>Pre-configured Audit Sites</h3>
      
      {sites.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.7)" }}>No pre-configured sites found.</p>
      ) : (
        <div style={{ maxHeight: "400px", overflowY: "auto" }}>
          {sites.map((site, index) => (
            <div
              key={index}
              onClick={() => !disabled && onSiteSelect(site)}
              style={{
                background: disabled ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.1)",
                padding: "1rem",
                margin: "0.5rem 0",
                borderRadius: "5px",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.6 : 1,
                transition: "all 0.3s ease",
                border: "2px solid transparent"
              }}
              onMouseEnter={(e) => {
                if (!disabled) {
                  e.target.style.background = "rgba(255,255,255,0.2)";
                  e.target.style.border = "2px solid #007bff";
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled) {
                  e.target.style.background = "rgba(255,255,255,0.1)";
                  e.target.style.border = "2px solid transparent";
                }
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "white" }}>{site.displayName}</h4>
                  <p style={{ margin: "0 0 0.5rem 0", color: "rgba(255,255,255,0.8)", fontSize: "0.9rem" }}>
                    {site.base}
                  </p>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.6)", fontSize: "0.8rem" }}>
                    {site.pathCount} pages • {formatDate(site.created)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// FileUpload component (same as before)
function FileUpload({ onFileUpload, disabled }) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file) => {
    if (file.type !== 'application/json') {
      alert('Please upload a JSON file');
      return;
    }
    onFileUpload(file);
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div>
      <div
        style={{
          border: `2px dashed ${dragActive ? '#007bff' : '#ccc'}`,
          borderRadius: "10px",
          padding: "2rem",
          textAlign: "center",
          background: dragActive ? "rgba(0,123,255,0.1)" : "rgba(255,255,255,0.9)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          transition: "all 0.3s ease"
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <p style={{ fontSize: "1.2rem", color: "#333", margin: "0 0 1rem 0" }}>
          {dragActive ? 'Drop the JSON file here' : 'Drag & drop your JSON config file here'}
        </p>
        <p style={{ color: "#666", margin: "0 0 1rem 0" }}>or</p>
        <input
          type="file"
          accept=".json"
          onChange={handleChange}
          style={{ display: 'none' }}
          disabled={disabled}
          id="fileInput"
        />
        <label
          htmlFor="fileInput"
          style={{
            background: "#007bff",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: "5px",
            fontSize: "1rem",
            cursor: disabled ? "not-allowed" : "pointer",
            display: "inline-block"
          }}
        >
          Choose File
        </label>
      </div>
      
      <div style={{ 
        marginTop: "2rem", 
        color: "#333",
        padding: "1rem", 
        background: "rgba(255,255,255,0.8)", 
        borderRadius: "5px",
        textAlign: "left"
      }}>
        <h4 style={{ margin: "0 0 1rem 0", color: "#333" }}>Expected JSON format:</h4>
        <pre style={{ 
          background: "#f8f9fa", 
          padding: "1rem", 
          borderRadius: "3px", 
          overflow: "auto",
          margin: 0,
          fontSize: "0.9rem"
        }}>{`{
  "base": "https://example.com",
  "paths": [
    "/",
    "/about",
    "/contact"
  ]
}`}</pre>
      </div>
    </div>
  );
}

// FileBrowser component (same as before)
function FileBrowser({ folders, files, selectedFolder, onFolderSelect, onFileDownload, onZipDownload, onDeleteClick, formatFileSize, formatDate }) {
  return (
    <div>
      <h2 style={{ color: "white", marginBottom: "1rem" }}>Report Folders</h2>
      
      {folders.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.7)" }}>No report folders found. Run an audit to generate reports.</p>
      ) : (
        <div style={{ marginBottom: "2rem" }}>
          {folders.map((folder, index) => (
            <div
              key={index}
              style={{
                background: selectedFolder === folder.name ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)",
                padding: "1rem",
                margin: "0.5rem 0",
                borderRadius: "5px",
                border: selectedFolder === folder.name ? "2px solid #007bff" : "2px solid transparent",
                transition: "all 0.3s ease"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div 
                  onClick={() => onFolderSelect(folder.name)}
                  style={{ flex: 1, cursor: "pointer" }}
                >
                  <h3 style={{ margin: "0 0 0.5rem 0", color: "white" }}>{folder.name}</h3>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" }}>
                    Created: {formatDate(folder.created)}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <div style={{ fontSize: "1.5rem" }}>📁</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClick(folder.name);
                    }}
                    style={{
                      background: "#dc3545",
                      color: "white",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "3px",
                      cursor: "pointer",
                      fontSize: "0.9rem"
                    }}
                    title="Delete folder"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedFolder && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ color: "white", margin: 0 }}>Files in {selectedFolder}</h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => onZipDownload()}
                style={{
                  background: "#28a745",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontSize: "0.9rem"
                }}
              >
                📦 Download All as ZIP
              </button>
              <button
                onClick={() => onDeleteClick(selectedFolder)}
                style={{
                  background: "#dc3545",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontSize: "0.9rem"
                }}
              >
                🗑️ Delete Folder
              </button>
            </div>
          </div>
          
          {files.length === 0 ? (
            <p style={{ color: "rgba(255,255,255,0.7)" }}>No files found in this folder.</p>
          ) : (
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              {files.map((file, index) => (
                <div
                  key={index}
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    padding: "1rem",
                    margin: "0.5rem 0",
                    borderRadius: "5px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div>
                    <div style={{ color: "white", fontWeight: "bold" }}>{file.name}</div>
                    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.9rem" }}>
                      {formatFileSize(file.size)} • {formatDate(file.created)}
                    </div>
                  </div>
                  <button
                    onClick={() => onFileDownload(file.name)}
                    style={{
                      background: "#007bff",
                      color: "white",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "3px",
                      cursor: "pointer",
                      fontSize: "0.9rem"
                    }}
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// AuditProgress component (same as before)
function AuditProgress({ status }) {
  const getStatusColor = () => {
    switch (status.status) {
      case 'uploading': return '#007bff';
      case 'running': return '#ffc107';
      case 'completed': return '#28a745';
      case 'error': return '#dc3545';
      default: return '#6c757d';
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <div 
          style={{ 
            width: "12px", 
            height: "12px", 
            borderRadius: "50%", 
            backgroundColor: getStatusColor(),
            animation: status.status === 'running' ? "pulse 2s infinite" : "none"
          }}
        />
        <span style={{ fontSize: "1.1rem", color: "#333" }}>{status.message}</span>
      </div>
      
      {status.status === 'running' && (
        <div style={{ 
          width: "100%", 
          height: "8px", 
          background: "#e9ecef", 
          borderRadius: "4px", 
          overflow: "hidden",
          margin: "1rem 0"
        }}>
          <div style={{ 
            height: "100%", 
            background: "linear-gradient(90deg, #007bff, #0056b3)",
            animation: "progress 2s infinite",
            width: "100%"
          }} />
        </div>
      )}
      
      {status.status === 'completed' && status.reportPath && (
        <div style={{ textAlign: "center", padding: "1rem 0" }}>
          <h3 style={{ color: "#28a745", margin: "0 0 1rem 0" }}>Audit Complete!</h3>
          <p style={{ margin: "0 0 1rem 0", color: "#333" }}>
            Reports generated in: <code style={{ background: "#f8f9fa", padding: "0.2rem 0.5rem", borderRadius: "3px" }}>{status.reportPath}</code>
          </p>
          <p style={{ margin: "0 0 1rem 0", color: "#666", fontSize: "0.9rem" }}>
            Switching to Browse Reports tab...
          </p>
        </div>
      )}
      
      {status.status === 'error' && (
        <div style={{ textAlign: "center", color: "#dc3545" }}>
          <h3 style={{ margin: "0 0 1rem 0" }}>Error occurred</h3>
          <p style={{ margin: 0 }}>{status.message}</p>
        </div>
      )}
      
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}