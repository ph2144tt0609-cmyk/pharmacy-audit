import { useEffect, useMemo } from 'react';
import type { Prescription } from '../db';
import { formatDateTime } from '../utils';

interface Props {
  prescription: Prescription;
  onClose: () => void;
}

export function PrintView({ prescription, onClose }: Props) {
  const photoUrls = useMemo(
    () =>
      prescription.items.map((it) =>
        it.weighPhoto ? URL.createObjectURL(it.weighPhoto) : null,
      ),
    [prescription],
  );

  useEffect(() => {
    return () => {
      photoUrls.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [photoUrls]);

  const photoCellClass =
    prescription.items.length <= 2 ? 'photo-lg'
    : prescription.items.length <= 4 ? 'photo-md'
    : 'photo-sm';

  return (
    <div className="print-wrap">
      <div className="screen-only print-toolbar">
        <button type="button" onClick={onClose}>戻る</button>
        <button type="button" className="primary" onClick={() => window.print()}>
          印刷 (AirPrint)
        </button>
      </div>

      <div className="sheet">
        <header className="sheet-head">
          <h1>調剤監査記録</h1>
          <div className="head-meta">
            <div><span className="lbl">処方箋番号</span><span className="val">{prescription.number}</span></div>
            <div><span className="lbl">日時</span><span className="val">{formatDateTime(prescription.createdAt)}</span></div>
            <div><span className="lbl">調剤者</span><span className="val">{prescription.operator}</span></div>
          </div>
        </header>

        <table className="sheet-table">
          <thead>
            <tr>
              <th className="col-no">#</th>
              <th className="col-drug">薬品 / GS1</th>
              <th className="col-weight">秤量</th>
              <th className="col-photo">写真</th>
            </tr>
          </thead>
          <tbody>
            {prescription.items.map((it, i) => (
              <tr key={it.id}>
                <td className="col-no">{i + 1}</td>
                <td>
                  {it.drugName && <div className="drug-name">{it.drugName}</div>}
                  <dl className="gs1-print">
                    {it.gtin && (<><dt>GTIN</dt><dd>{it.gtin}</dd></>)}
                    {it.lot && (<><dt>ロット</dt><dd>{it.lot}</dd></>)}
                    {it.expiry && (<><dt>期限</dt><dd>{it.expiry}</dd></>)}
                    {it.serial && (<><dt>S/N</dt><dd>{it.serial}</dd></>)}
                  </dl>
                </td>
                <td className="col-weight">{it.grams ? `${it.grams} g` : '-'}</td>
                <td className={`col-photo ${photoCellClass}`}>
                  {photoUrls[i] ? <img src={photoUrls[i]!} alt="" /> : <span className="no-photo">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
