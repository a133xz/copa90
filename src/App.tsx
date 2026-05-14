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
      setOutput([`TARGET: ${finalDest}`, `STATUS: INITIALIZING INGEST`]);

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
      setOutput([`SOURCE: ${sourceDrive}`, `TARGET: ${destDrive}`, `STATUS: MIRRORING`]);

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
          <FolderDown size={18} strokeWidth={2.5} />
          INGEST
        </div>
        
        <div 
          className={`nav-item ${view === 'backup' ? 'active' : ''}`}
          onClick={() => setView('backup')}
        >
          <ArrowLeftRight size={18} strokeWidth={2.5} />
          BACKUP
        </div>

        <div style={{ marginTop: 'auto' }}>
           <div className="nav-item" onClick={refreshVolumes}>
            <RefreshCw size={18} strokeWidth={2.5} className={isProcessing ? 'pulse' : ''} />
            RESCAN DRIVES
          </div>
        </div>
      </aside>

      <main className="main-content">
        {view === 'ingest' ? (
          <div>
            <div className="view-header">
              <h1>MEDIA INGEST</h1>
              <p>TRANSFER MEDIA TO PRODUCTION DRIVE</p>
            </div>

            <div className="grid">
              <div className="card">
                <div className="form-group">
                  <label className="label">SOURCE (SD CARD)</label>
                  <select value={sourceDrive} onChange={e => setSourceDrive(e.target.value)}>
                    <option value="">SELECT SOURCE...</option>
                    {volumes.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">DESTINATION DRIVE</label>
                  <select value={destDrive} onChange={e => setDestDrive(e.target.value)}>
                    <option value="">SELECT DESTINATION...</option>
                    {volumes.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div className="card">
                <div className="form-group">
                  <label className="label">DAY NUMBER</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={day} 
                    onChange={e => setDay(e.target.value)} 
                    placeholder="e.g. 1"
                  />
                </div>
                <div className="form-group">
                  <label className="label">CAMERA ID</label>
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
              style={{ width: '100%', padding: '24px', fontSize: '20px' }}
              disabled={isProcessing || !sourceDrive || !destDrive || sourceDrive === destDrive}
              onClick={handleStartIngest}
            >
              {isProcessing ? <RefreshCw className="pulse" size={24} strokeWidth={3} /> : <Play size={24} strokeWidth={3} />}
              {isProcessing ? 'PROCESSING...' : 'EXECUTE INGEST'}
            </button>
          </div>
        ) : (
          <div>
            <div className="view-header">
              <h1>DRIVE BACKUP</h1>
              <p>EXACT MIRROR VIA RSYNC --DELETE</p>
            </div>

            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="grid" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label className="label">MASTER DRIVE</label>
                  <select value={sourceDrive} onChange={e => setSourceDrive(e.target.value)}>
                    <option value="">SELECT MASTER...</option>
                    {volumes.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">BACKUP DRIVE</label>
                  <select value={destDrive} onChange={e => setDestDrive(e.target.value)}>
                    <option value="">SELECT BACKUP...</option>
                    {volumes.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '24px', fontSize: '20px' }}
              disabled={isProcessing || !sourceDrive || !destDrive || sourceDrive === destDrive}
              onClick={handleStartBackup}
            >
              {isProcessing ? <RefreshCw className="pulse" size={24} strokeWidth={3} /> : <ArrowLeftRight size={24} strokeWidth={3} />}
              {isProcessing ? 'SYNCING...' : 'EXECUTE MIRROR'}
            </button>
          </div>
        )}

        {status !== 'idle' && (
          <div style={{ marginTop: '40px' }}>
            <div className="status-bar">
              <div className="status-indicator">
                {status === 'running' && <RefreshCw className="pulse" size={16} strokeWidth={3} />}
                {status === 'success' && <SquareTerminal size={16} strokeWidth={3} />}
                {status === 'error' && <AlertTriangle size={16} strokeWidth={3} />}
                <span>
                  {status === 'running' ? 'SYSTEM: ACTIVE' : status === 'success' ? 'SYSTEM: COMPLETE' : 'SYSTEM: ERROR'}
                </span>
              </div>
              
              {status === 'success' && lastPath && (
                <button 
                  className="btn" 
                  style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', height: 'auto' }}
                  onClick={openFolder}
                >
                  <ExternalLink size={14} strokeWidth={2.5} />
                  OPEN FOLDER
                </button>
              )}
            </div>
            
            <div className="output-log" ref={outputRef}>
              {output.map((line, i) => (
                <div key={i} className="output-line">{line}</div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
