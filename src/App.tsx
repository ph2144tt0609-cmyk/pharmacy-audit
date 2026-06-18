import { useEffect, useState } from 'react';
import { db, ensureSeedData, type Prescription } from './db';
import { loadGtinMaster } from './gtinMaster';
import { PrescriptionEditor } from './components/PrescriptionEditor';
import { PrescriptionList } from './components/PrescriptionList';
import { PrintView } from './components/PrintView';
import { Settings } from './components/Settings';
import './App.css';

type View =
  | { kind: 'list' }
  | { kind: 'edit'; id?: number }
  | { kind: 'print'; prescription: Prescription }
  | { kind: 'settings' };

export default function App() {
  const [view, setView] = useState<View>({ kind: 'list' });
  const [loaded, setLoaded] = useState<Prescription | undefined>();

  useEffect(() => {
    ensureSeedData();
    // 公式GTINマスターをメモリへ読み込む（失敗してもアプリは動作する）
    loadGtinMaster().catch(() => {});
  }, []);

  useEffect(() => {
    if (view.kind === 'edit' && view.id !== undefined) {
      db.prescriptions.get(view.id).then((p) => setLoaded(p));
    } else {
      setLoaded(undefined);
    }
  }, [view]);

  return (
    <div className="app">
      <header className="app-head screen-only">
        <h1>調剤監査</h1>
        {view.kind === 'list' && (
          <button type="button" className="settings-btn" onClick={() => setView({ kind: 'settings' })}>
            設定
          </button>
        )}
      </header>

      <main>
        {view.kind === 'list' && (
          <PrescriptionList
            onNew={() => setView({ kind: 'edit' })}
            onOpen={(id) => setView({ kind: 'edit', id })}
          />
        )}

        {view.kind === 'edit' && (
          (view.id === undefined || loaded) && (
            <PrescriptionEditor
              initial={loaded}
              onCancel={() => setView({ kind: 'list' })}
              onSaved={async (id) => {
                const p = await db.prescriptions.get(id);
                if (p) setView({ kind: 'print', prescription: p });
                else setView({ kind: 'list' });
              }}
            />
          )
        )}

        {view.kind === 'print' && (
          <PrintView
            prescription={view.prescription}
            onClose={() => setView({ kind: 'list' })}
          />
        )}

        {view.kind === 'settings' && (
          <Settings onClose={() => setView({ kind: 'list' })} />
        )}
      </main>
    </div>
  );
}
