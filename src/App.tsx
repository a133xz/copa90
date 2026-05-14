import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { 
  FolderDown, 
  ArrowLeftRight, 
  Play, 
  SquareTerminal,
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

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
      setOutput(prev => [...prev.slice(-50), event.payload as string]);
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
      setOutput([`Target: ${finalDest}`, `Status: Initializing ingest...`]);

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
      setOutput([`Source: ${sourceDrive}`, `Target: ${destDrive}`, `Status: Mirroring...`]);

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
        <div className="logo">COPA90</div>
        
        <div 
          className={`nav-item ${view === 'ingest' ? 'active' : ''}`}
          onClick={() => setView('ingest')}
        >
          <FolderDown size={16} />
          Media Ingest
        </div>
        
        <div 
          className={`nav-item ${view === 'backup' ? 'active' : ''}`}
          onClick={() => setView('backup')}
        >
          <ArrowLeftRight size={16} />
          Drive Sync
        </div>

        <div style={{ marginTop: 'auto', marginBottom: '8px' }}>
           <div className="nav-item" onClick={refreshVolumes}>
            <RefreshCw size={16} className={isProcessing ? 'spin' : ''} />
            Refresh Drives
          </div>
        </div>
      </aside>

      <main className="main-content">
        {view === 'ingest' ? (
          <>
            <div className="view-header">
              <h1>Media Ingest</h1>
            </div>

            <div className="card">
              <div className="row">
                <div className="col">
                  <label className="label">Source (SD Card)</label>
                  <select value={sourceDrive} onChange={e => setSourceDrive(e.target.value)}>
                    <option value="">Select source...</option>
                    {volumes.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="col">
                  <label className="label">Destination Drive</label>
                  <select value={destDrive} onChange={e => setDestDrive(e.target.value)}>
                    <option value="">Select destination...</option>
                    {volumes.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <div className="col">
                  <label className="label">Day</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={day} 
                    onChange={e => setDay(e.target.value)} 
                    placeholder="1"
                  />
                </div>
                <div className="col">
                  <label className="label">Camera ID</label>
                  <div className="btn-group">
                    {['A', 'B', 'C', 'D'].map(letter => (
                      <button 
                        key={letter}
                        className={`btn ${camera === letter ? 'active' : ''}`}
                        onClick={() => setCamera(letter)}
                      >
                        {letter}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button 
              className="btn btn-primary" 
              style={{ height: '48px', fontSize: '14px', marginTop: '8px' }}
              disabled={isProcessing || !sourceDrive || !destDrive || sourceDrive === destDrive}
              onClick={handleStartIngest}
            >
              {isProcessing ? <RefreshCw className="spin" size={18} /> : <Play size={18} />}
              {isProcessing ? 'Processing Ingest...' : 'Start Ingest'}
            </button>
          </>
        ) : (
          <>
            <div className="view-header">
              <h1>Drive Sync</h1>
            </div>

            <div className="card">
              <div className="row">
                <div className="col">
                  <label className="label">Main Drive (Source)</label>
                  <select value={sourceDrive} onChange={e => setSourceDrive(e.target.value)}>
                    <option value="">Select main...</option>
                    {volumes.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="col">
                  <label className="label">Backup Drive (Destination)</label>
                  <select value={destDrive} onChange={e => setDestDrive(e.target.value)}>
                    <option value="">Select backup...</option>
                    {volumes.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            <button 
              className="btn btn-primary" 
              style={{ height: '48px', fontSize: '14px', marginTop: '8px' }}
              disabled={isProcessing || !sourceDrive || !destDrive || sourceDrive === destDrive}
              onClick={handleStartBackup}
            >
              {isProcessing ? <RefreshCw className="spin" size={18} /> : <ArrowLeftRight size={18} />}
              {isProcessing ? 'Syncing...' : 'Start Sync'}
            </button>
          </>
        )}

        <div className="status-section">
          {status !== 'idle' && (
            <>
              <div className={`status-bar ${status === 'running' ? 'has-log' : ''}`} style={{ borderColor: status === 'error' ? '#ef4444' : status === 'success' ? '#22c55e' : 'var(--border)' }}>
                <div className="status-indicator">
                  {status === 'running' && <RefreshCw className="spin" size={14} color="var(--focus)" />}
                  {status === 'success' && <SquareTerminal size={14} color="#22c55e" />}
                  {status === 'error' && <AlertTriangle size={14} color="#ef4444" />}
                  <span style={{ color: status === 'error' ? '#ef4444' : status === 'success' ? '#22c55e' : 'var(--fg)' }}>
                    {status === 'running' ? 'System Active' : status === 'success' ? 'Task Complete' : 'Task Failed'}
                  </span>
                </div>
                
                {status === 'success' && lastPath && (
                  <button 
                    className="btn btn-ghost" 
                    style={{ padding: '4px 10px', fontSize: '11px', height: 'auto', border: '1px solid var(--border)' }}
                    onClick={openFolder}
                  >
                    <ExternalLink size={12} />
                    Reveal in Finder
                  </button>
                )}
              </div>
              
              {status === 'running' && (
                <div className="output-log" ref={outputRef}>
                  {output.map((line, i) => (
                    <div key={i} className="output-line">{line}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
