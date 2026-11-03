/*
 * The Excel and printable reports: one sheet per day plus a summary. The
 * workbook library is ~415 KB and is only touched when a report is exported,
 * so it is fetched the first time one of those actions runs.
 */

import { groupByDay, uniqueEmployeeCount } from './booking.js';
import { WAITLIST } from './config.js';
import { esc } from './format.js';



/* =============================================================
 * 4. Excel report (one sheet per day + a summary sheet)
 * =============================================================
 * The workbook library is ~415 KB and is only touched when a report
 * is exported, so it is fetched the first time one of those actions
 * runs rather than on every page load. The service worker keeps a
 * copy, so exporting still works offline after the first use.
 */

let xlsxPromise = null;


export const ensureXlsx = () => {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxPromise) {
        xlsxPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'vendor/xlsx.bundle.js';
            script.onload = () => {
                if (window.XLSX) resolve(window.XLSX);
                else reject(new Error('The Excel library did not initialise.'));
            };
            script.onerror = () => reject(new Error('Could not load the Excel library.'));
            document.head.appendChild(script);
        });
        // A failed load must not be remembered, or every later export
        // would fail too instead of retrying.
        xlsxPromise.catch(() => { xlsxPromise = null; });
    }
    return xlsxPromise;
};


const THIN = { style: 'thin', color: { rgb: 'C9D6E2' } };

const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };


const TITLE_STYLE = {
    font: { bold: true, sz: 13, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '00385F' } },
    alignment: { horizontal: 'center', vertical: 'center' }
};

const HEADER_STYLE = {
    font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: 'F58220' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: BORDER
};

const BODY_STYLE = {
    font: { sz: 11, color: { rgb: '1F2937' } },
    alignment: { vertical: 'center' },
    border: BORDER
};

const WAITLIST_STYLE = {
    font: { sz: 11, bold: true, color: { rgb: 'B91C1C' } },
    alignment: { vertical: 'center' },
    border: BORDER
};

const TOTAL_STYLE = {
    font: { bold: true, sz: 11, color: { rgb: '00385F' } },
    fill: { fgColor: { rgb: 'E6F0F7' } },
    alignment: { vertical: 'center' },
    border: BORDER
};


const setCell = (ws, r, c, value, style) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    const isNum = typeof value === 'number';
    ws[addr] = { v: value == null ? '' : value, t: isNum ? 'n' : 's', s: style };
};


const DAY_HEADERS = ['Employee Name', 'Employee ID', 'Booking Time', 'Pickup Point', 'Type', 'Bus'];


const buildDaySheet = (day, items) => {
    const ws = {};
    const lastCol = DAY_HEADERS.length - 1;
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: items.length + 2, c: lastCol } });

    // Row 1 — title (merged)
    setCell(ws, 0, 0, `Alorica — Transportation Bookings — ${day}`, TITLE_STYLE);
    for (let c = 1; c <= lastCol; c++) setCell(ws, 0, c, '', TITLE_STYLE);

    // Row 2 — headers
    DAY_HEADERS.forEach((h, c) => setCell(ws, 1, c, h, HEADER_STYLE));

    // Data rows
    items.forEach((b, i) => {
        const r = i + 2;
        setCell(ws, r, 0, b.employeeName || '', BODY_STYLE);
        setCell(ws, r, 1, String(b.employeeId || ''), BODY_STYLE);
        setCell(ws, r, 2, b.time || '', BODY_STYLE);
        setCell(ws, r, 3, b.location || '', BODY_STYLE);
        setCell(ws, r, 4, b.type || '', BODY_STYLE);
        setCell(ws, r, 5, b.bus || '-', b.bus === WAITLIST ? WAITLIST_STYLE : BODY_STYLE);
    });

    // Total row
    const totalRow = items.length + 2;
    setCell(ws, totalRow, 0, 'Total bookings', TOTAL_STYLE);
    for (let c = 1; c < lastCol; c++) setCell(ws, totalRow, c, '', TOTAL_STYLE);
    setCell(ws, totalRow, lastCol, items.length, TOTAL_STYLE);

    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }];
    ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 32 }, { wch: 12 }, { wch: 14 }];
    ws['!rows'] = [{ hpt: 24 }, { hpt: 20 }];
    ws['!autofilter'] = { ref: `A2:F${items.length + 2}` };
    return ws;
};


const buildSummarySheet = (bookings, buses) => {
    const groups = groupByDay(bookings);
    const busNames = buses.map((b) => b.name);
    const head = ['Day', 'Bookings', 'Employees', ...busNames, WAITLIST];
    const lastCol = head.length - 1;

    const titleRow = [`Alorica — Transportation Summary (${bookings.length} bookings)`];
    while (titleRow.length <= lastCol) titleRow.push('');

    const aoa = [
        titleRow,
        ['Generated', new Date().toLocaleString()],
        [],
        head
    ];

    groups.forEach(({ day, items }) => {
        const counts = {};
        busNames.forEach((n) => { counts[n] = 0; });
        let wait = 0;
        items.forEach((b) => {
            if (!b.bus || b.bus === WAITLIST) wait += 1;
            else if (counts[b.bus] != null) counts[b.bus] += 1;
            else counts[b.bus] = 1;
        });
        aoa.push([day, items.length, uniqueEmployeeCount(items), ...busNames.map((n) => counts[n]), wait]);
    });

    aoa.push([
        'Total',
        bookings.length,
        uniqueEmployeeCount(bookings),
        ...busNames.map((n) => bookings.filter((b) => b.bus === n).length),
        bookings.filter((b) => !b.bus || b.bus === WAITLIST).length
    ]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }];
    ws['!cols'] = [{ wch: 18 }, { wch: 11 }, { wch: 11 }, ...busNames.map(() => ({ wch: 12 })), { wch: 11 }];

    const totalRow = aoa.length - 1;
    for (let r = 0; r <= totalRow; r++) {
        for (let c = 0; c <= lastCol; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (!ws[addr]) continue;
            if (r === 0) ws[addr].s = TITLE_STYLE;
            else if (r === 3) ws[addr].s = HEADER_STYLE;
            else if (r === totalRow) ws[addr].s = TOTAL_STYLE;
            else ws[addr].s = BODY_STYLE;
        }
    }
    return ws;
};


export const buildWorkbook = (bookings, buses) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildSummarySheet(bookings, buses), 'Summary');
    groupByDay(bookings).forEach(({ day, items }) => {
        const safeName = String(day).replace(/[^\w-]/g, '-').slice(0, 31) || 'Sheet';
        XLSX.utils.book_append_sheet(wb, buildDaySheet(day, items), safeName);
    });
    return wb;
};




export const buildPrintHtml = (bookings) => {
    const groups = groupByDay(bookings);
    const sections = groups.map(({ day, items }) => `
        <section class="day">
            <div class="day-head">
                <h2>${esc(day)}</h2>
                <span>${items.length} booking${items.length === 1 ? '' : 's'}</span>
            </div>
            <table>
                <thead>
                    <tr>
                        <th class="num">#</th>
                        <th>Employee Name</th>
                        <th>Employee ID</th>
                        <th>Booking Time</th>
                        <th>Pickup Point</th>
                        <th>Type</th>
                        <th>Bus</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((b, i) => `
                    <tr>
                        <td class="num">${i + 1}</td>
                        <td>${esc(b.employeeName)}</td>
                        <td>${esc(b.employeeId)}</td>
                        <td>${esc(b.time)}</td>
                        <td>${esc(b.location)}</td>
                        <td>${esc(b.type)}</td>
                        <td class="${b.bus === WAITLIST ? 'wait' : ''}">${esc(b.bus || '-')}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </section>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Alorica Transport Bookings</title>
<style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; margin: 24px; }
    header { border-bottom: 3px solid #F58220; padding-bottom: 10px; margin-bottom: 20px; }
    header h1 { margin: 0; color: #00385F; font-size: 22px; }
    header p { margin: 6px 0 0; color: #6b7280; font-size: 12px; }
    .day { margin-bottom: 26px; page-break-inside: avoid; }
    .day:not(:last-child) { page-break-after: always; }
    .day-head { display: flex; justify-content: space-between; align-items: baseline; background: #00385F; color: #fff; padding: 8px 12px; border-radius: 6px 6px 0 0; }
    .day-head h2 { margin: 0; font-size: 15px; }
    .day-head span { font-size: 11px; opacity: .85; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 7px 9px; font-size: 12px; text-align: left; }
    thead th { background: #e6f0f7; color: #00385F; }
    tbody tr:nth-child(even) { background: #fafafa; }
    td.num, th.num { width: 34px; text-align: center; }
    td.wait { color: #b91c1c; font-weight: bold; }
    footer { margin-top: 24px; font-size: 11px; color: #9ca3af; text-align: center; }
    @page { margin: 14mm; }
</style>
</head>
<body>
    <header>
<h1>Alorica &mdash; Employee Transportation Bookings</h1>
<p>Generated: ${esc(new Date().toLocaleString())} &nbsp;|&nbsp; Total bookings: ${bookings.length} &nbsp;|&nbsp; Days: ${groups.length}</p>
    </header>
    ${sections || '<p>No bookings available.</p>'}
    <footer>&copy; 2026 Alorica Inc. All Rights Reserved.</footer>
</body>
</html>`;
};
