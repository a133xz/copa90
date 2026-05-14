import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { 
  FolderDown, 
  ArrowLeftRight, 
  Play, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type View = 'ingest' | 'backup';

function App() {
  const [view, setView] = useState<View>('ingest');
  const [volumes, setVolumes] = useState<string[]>([]);
  const [sourceDrive, setSourceDrive] = useState('');
  const [destDrive, setDestDrive] = useState('');
  const [day, setDay] = useState('1');
  const [camera, setCamera] = useState('A');
  const [isProcessing, setIsProcessing] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [lastPath, setLastPath] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshVolumes();
    
    const unlistenOutput = listen('rsync-output', (event) => {
      setOutput(prev => [...prev.slice(-100), event.payload as string]);
    });

    const unlistenFinished = listen('rsync-finished', (event) => {
      setIsProcessing(false);
      setStatus(event.payload ? 'success' : 'error');
    });

    return () => {
      unlistenOutput.then(u => u());
      unlistenFinished.then(u => u());
    };
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const refreshVolumes = async () => {
    try {
      const v = await invoke<string[]>('get_volumes');
      setVolumes(v);
      if (v.length > 0) {
        if (!sourceDrive) setSourceDrive(v[0]);
        if (!destDrive && v.length > 1) setDestDrive(v[1]);
      }
    } catch (err) {
      console.error('Failed to fetch volumes:', err);
    }
  };

  const handleStartIngest = async () => {
    setIsProcessing(true);
    setStatus('running');
    setOutput([]);

    try {
      const nextRollNum = await invoke<number>('get_next_roll', { 
        destDrive, 
        camLetter: camera 
      });
      
      const dayFolder = `Day_${day.padStart(2, '0')}`;
      const camFolder = `${camera.toUpperCase()}_CAM`;
      const rollFolder = `${camera.toUpperCase()}${nextRollNum.toString().padStart(3, '0')}`;
      
      const finalDest = `/Volumes/${destDrive}/${dayFolder}/${camFolder}/${rollFolder}`;
      const sourcePath = `/Volumes/${sourceDrive}`;

      setLastPath(finalDest);
      setOutput([`Target: ${finalDest}`, `Starting ingest...`]);

      await invoke('start_rsync', {
        source: sourcePath,
        destination: finalDest,
        delete: false
      });
    } catch (err) {
      console.error('Ingest failed:', err);
      setStatus('error');
      setIsProcessing(false);
    }
  };

  const handleStartBackup = async () => {
    setIsProcessing(true);
    setStatus('running');
    setOutput([]);

    try {
      const sourcePath = `/Volumes/${sourceDrive}`;
      const destPath = `/Volumes/${destDrive}`;

      setLastPath(`/Volumes/${destDrive}`);
      setOutput([`Mirroring ${sourceDrive} to ${destDrive}...`]);

      await invoke('start_rsync', {
        source: sourcePath,
        destination: destPath,
        delete: true
      });
    } catch (err) {
      console.error('Backup failed:', err);
      setStatus('error');
      setIsProcessing(false);
    }
  };

  const openFolder = async () => {
    if (lastPath) {
      await revealItemInDir(lastPath);
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo">COPA</div>
        
        <div 
          className={`nav-item ${view === 'ingest' ? 'active' : ''}`}
          onClick={() => setView('ingest')}
        >
          <FolderDown size={20} />
          Ingest
        </div>
        
        <div 
          className={`nav-item ${view === 'backup' ? 'active' : ''}`}
          onClick={() => setView('backup')}
        >
          <ArrowLeftRight size={20} />
          Backup
        </div>

        <div style={{ marginTop: 'auto' }}>
           <div className="nav-item" onClick={refreshVolumes}>
            <RefreshCw size={20} className={isProcessing ? 'pulse' : ''} />
            Refresh Drives
          </div>
        </div>
      </aside>

      <main className="main-content">
        <AnimatePresence mode="wait">
          {view === 'ingest' ? (
            <motion.div 
              key="ingest"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="view-header">
                <h1>Media Ingest</h1>
                <p>Transfer footage from SD card to production drive.</p>
              </div>

              <div className="grid">
                <div className="card">
                  <div className="form-group">
                    <label className="label">Source Drive (SD Card)</label>
                    <select value={sourceDrive} onChange={e => setSourceDrive(e.target.value)}>
                      <option value="">Select source...</option>
                      {volumes.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Destination Drive</label>
                    <select value={destDrive} onChange={e => setDestDrive(e.target.value)}>
                      <option value="">Select destination...</option>
                      {volumes.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>

                <div className="card">
                  <div className="form-group">
                    <label className="label">Day Number</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Calendar size={18} color="#a1a1aa" />
                      <input 
                        type="number" 
                        min="1" 
                        value={day} 
                        onChange={e => setDay(e.target.value)} 
                        placeholder="e.g. 1"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="label">Camera Letter</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {['A', 'B', 'C', 'D'].map(letter => (
                        <button 
                          key={letter}
                          className={`btn btn-secondary ${camera === letter ? 'active' : ''}`}
                          style={{ 
                            padding: '8px 16px', 
                            flex: 1,
                            borderColor: camera === letter ? 'var(--primary)' : 'var(--card-border)',
                            color: camera === letter ? 'var(--primary)' : 'white'
                          }}
                          onClick={() => setCamera(letter)}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <button 
                  className="btn" 
                  disabled={isProcessing || !sourceDrive || !destDrive || sourceDrive === destDrive}
                  onClick={handleStartIngest}
                >
                  {isProcessing ? <RefreshCw className="pulse" size={20} /> : <Play size={20} />}
                  {isProcessing ? 'Ingesting...' : 'Start Ingest'}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="backup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="view-header">
                <h1>Drive Backup</h1>
                <p>Mirror master drive to backup drive (rsync --delete).</p>
              </div>

              <div className="card">
                <div className="grid">
                  <div className="form-group">
                    <label className="label">Source (Master)</label>
                    <select value={sourceDrive} onChange={e => setSourceDrive(e.target.value)}>
                      <option value="">Select master...</option>
                      {volumes.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Destination (Backup)</label>
                    <select value={destDrive} onChange={e => setDestDrive(e.target.value)}>
                      <option value="">Select backup...</option>
                      {volumes.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
                
                <button 
                  className="btn btn-accent" 
                  disabled={isProcessing || !sourceDrive || !destDrive || sourceDrive === destDrive}
                  onClick={handleStartBackup}
                >
                  {isProcessing ? <RefreshCw className="pulse" size={20} /> : <ArrowLeftRight size={20} />}
                  {isProcessing ? 'Syncing...' : 'Sync Drives'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {status !== 'idle' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {status === 'running' && <RefreshCw className="pulse" size={18} color="var(--primary)" />}
                {status === 'success' && <CheckCircle size={18} color="var(--accent)" />}
                {status === 'error' && <AlertCircle size={18} color="var(--danger)" />}
                <span style={{ fontWeight: 600 }}>
                  {status === 'running' ? 'Process Output' : status === 'success' ? 'Task Completed' : 'Task Failed'}
                </span>
              </div>
              
              {status === 'success' && lastPath && (
                <button 
                  className="btn btn-secondary" 
                  style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
                  onClick={openFolder}
                >
                  <ExternalLink size={14} />
                  Show in Finder
                </button>
              )}
            </div>
            
            <div className="output-log" ref={outputRef}>
              {output.map((line, i) => (
                <div key={i} className="output-line">{line}</div>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

export default App;
