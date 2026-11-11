import { Download } from 'lucide-react';
import channels from '../data/supplier-channels.json';
import '../styles/merchant-enrollment.css';
import '../styles/supplier-channels.css';

export default function SupplierChannels() {
  return <section className="page-content strategies-page supplier-channels-page" aria-labelledby="supplier-channels-heading">
    <h1 id="supplier-channels-heading">货盘渠道总表</h1>
    <header className="strategy-document-heading merchant-enrollment-source">
      <h2>{channels.title}</h2>
      <p className="strategy-document-source">来源：用户上传的 {channels.sourceFile} · 收录日期：{channels.importedOn}</p>
      <p><a href="/assets/supplier-channels/source.xlsx" download={channels.sourceFile}><Download size={16} aria-hidden="true" />下载原始 Excel</a></p>
      <p className="strategy-document-source">保留三个工作表的原始内容。表格较宽，可在表格区域横向滚动查看。</p>
    </header>
    <nav className="supplier-channels-contents" aria-label="货盘渠道工作表">{channels.sheets.map(sheet => <a key={sheet.id} href={`#${sheet.id}`}>{sheet.name}</a>)}</nav>
    <article className="strategy-document-article supplier-channels-article">
      {channels.sheets.map(sheet => <section key={sheet.id} id={sheet.id} tabIndex={-1} aria-labelledby={`${sheet.id}-heading`}>
        <h2 id={`${sheet.id}-heading`}>{sheet.name}</h2>
        <p>{sheet.title}</p>{sheet.notes.map((note,index) => <p key={index}>{note}</p>)}
        <div className="merchant-table-scroll" tabIndex={0} role="region" aria-label={`${sheet.name}，可横向滚动`}>
          <table aria-label={sheet.name}><thead><tr>{sheet.headers.map((header,index) => <th key={index} scope="col">{header}</th>)}</tr></thead>
            <tbody>{sheet.rows.map((row,index) => <tr key={index}>{row.slice(1).every(value => !value) ? <td colSpan={sheet.headers.length}>{row[0]}</td> : row.map((value,column) => <td key={column}>{value}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </section>)}
    </article>
  </section>;
}
