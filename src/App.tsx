import { useEffect, useState } from 'react';
import { db, type Prescription } from './db';
import { PrescriptionEditor } from './components/PrescriptionEditor';
import { PrescriptionList } from './components/PrescriptionList';
import { PrintView } from './components/PrintView';
import './App.css';

type View =
  | { kind: 'list' }
  | { kind: 'edit'; id?: number }
  | { kind: 'print'; prescription: Prescription };

export default function App() {
  const [view, setView] = useState<View>({ kind: 'list' });
  const [loaded, setLoaded] = useState<Prescription | undefined>();

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
      </main>
    </div>
  );
}
