import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { getAllDepartments } from '../db';
import { formatEventRecordNumber } from './recordUtils';

export const exportAttendancePDF = async (event, participants = [], admin) => {
  const depts = await getAllDepartments();
  const codeMap = {};
  depts.forEach(d => {
    codeMap[d.name] = d.code;
  });

  const formattedId = formatEventRecordNumber(event, codeMap);

  const eventType = event.type || event.event_type || 'Meeting';
  const eventSubject = event.name || event.subject || '';
  const eventDate = event.date || event.event_date || '';
  const eventTime = event.time || event.event_time || '';
  const eventDept = event.department || '';
  const eventVenue = event.venue || '';
  const eventRoom = event.room || '';
  const trainingTypeVal = eventType === 'Training'
    ? (event.training_type || event.trainingType || 'Recurrent')
    : '-';

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();   // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);        // 182mm

  // Preload AirAsia Logo
  let logoImg = null;
  try {
    const iconUrl = `${window.location.origin}/icon.png`;
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = iconUrl;
    await new Promise((resolve) => {
      img.onload = () => {
        logoImg = img;
        resolve();
      };
      img.onerror = () => resolve();
    });
  } catch (e) {}

  // Pre-generate Administrator QR Signature
  const creator = event.creator || admin || {};
  const adminName = creator.name || creator.full_name || event.creatorName || 'System Administrator';
  const adminStaffId = creator.staff_id || event.created_by || 'ADMIN-01';
  let adminSigDataUrl = event.creatorSignature || '';
  if (!adminSigDataUrl) {
    try {
      const adminVerification = `ADMIN VERIFIED | FORM: IAA/FOP/F/002 | REC: ${formattedId} | ADMIN: ${adminName} (${adminStaffId})`;
      adminSigDataUrl = await QRCode.toDataURL(adminVerification, { margin: 1, width: 140 });
    } catch (e) {
      console.error('Admin QR error:', e);
    }
  }

  // Helper to draw a bordered cell with optional background fill
  const drawCell = (x, y, w, h, fillRgb = null, lineWidth = 0.22, strokeRgb = [60, 60, 60]) => {
    doc.setDrawColor(strokeRgb[0], strokeRgb[1], strokeRgb[2]);
    doc.setLineWidth(lineWidth);
    if (fillRgb) {
      doc.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
      doc.rect(x, y, w, h, 'FD');
    } else {
      doc.rect(x, y, w, h, 'S');
    }
  };

  // Calculate dynamic subject height (default 5.6mm)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const subjectLines = doc.splitTextToSize(String(eventSubject), 63);
  const rowH = 5.6;
  const subjectRowH = subjectLines.length > 1 ? Math.max(rowH, subjectLines.length * 3.6 + 2) : rowH;

  const headerTop = 14;
  const headerH = 25;
  const infoTop = headerTop + headerH + 3.2; // 42.2mm
  const infoTotalH = rowH + subjectRowH + rowH + rowH;
  const tableStartY = infoTop + infoTotalH + 3.2; // ~68mm

  // Function to draw Top Header + Event Info Grid on a given page
  const drawPageHeaderAndInfo = (pageNum, totalPages) => {
    // 0. "INTERNAL" top-right label
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('INTERNAL', pageWidth - margin - 1, headerTop - 2, { align: 'right' });

    // 1. Top 3-Box Header (Logo | Attendance List | Rec. No. / Date / Page)
    const logoBoxW = 34;
    const titleBoxW = 90;
    const docBoxW = contentWidth - logoBoxW - titleBoxW; // 58mm

    drawCell(margin, headerTop, logoBoxW, headerH, null, 0.25, [40, 40, 40]);
    drawCell(margin + logoBoxW, headerTop, titleBoxW, headerH, null, 0.25, [40, 40, 40]);
    drawCell(margin + logoBoxW + titleBoxW, headerTop, docBoxW, headerH, null, 0.25, [40, 40, 40]);

    if (logoImg) {
      try {
        const logoSize = 20.5;
        const logoX = margin + (logoBoxW - logoSize) / 2;
        const logoY = headerTop + (headerH - logoSize) / 2;
        doc.addImage(logoImg, 'PNG', logoX, logoY, logoSize, logoSize);
      } catch (e) {}
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Attendance List', margin + logoBoxW + (titleBoxW / 2), headerTop + 14.2, { align: 'center' });

    const docX = margin + logoBoxW + titleBoxW + 2.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.text('Rec. No.:', docX, headerTop + 6.5);
    doc.setFontSize(7.2);
    doc.text(formattedId, docX + 14.5, headerTop + 6.5);

    doc.setFontSize(8.2);
    doc.text('Date:', docX, headerTop + 13.8);
    doc.text(eventDate, docX + 14.5, headerTop + 13.8);

    doc.text('Page:', docX, headerTop + 21.1);
    doc.text(`${pageNum} of ${totalPages}`, docX + 20, headerTop + 21.1);

    // 2. Event Info Grid
    let curY = infoTop;

    // Row 1: [ ] MEETING   [ ] TRAINING
    drawCell(margin, curY, contentWidth, rowH, [242, 242, 242], 0.2, [120, 120, 120]);
    const drawCheckItem = (bx, by, label, checked) => {
      doc.setDrawColor(0, 0, 0);
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(0.35);
      doc.rect(bx, by, 3.0, 3.0, 'FD');
      if (checked) {
        doc.setLineWidth(0.45);
        doc.line(bx + 0.4, by + 1.5, bx + 1.2, by + 2.5);
        doc.line(bx + 1.2, by + 2.5, bx + 2.6, by + 0.5);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      doc.text(label, bx + 5.2, by + 2.5);
    };
    drawCheckItem(margin + 61, curY + 1.3, 'MEETING', eventType === 'Meeting');
    drawCheckItem(margin + 94, curY + 1.3, 'TRAINING', eventType === 'Training');
    curY += rowH;

    // Grid Column Widths: Col1=36, Col2=66, Col3=22, Col4=58 (Total = 182)
    const c1W = 36;
    const c2W = 66;
    const c3W = 22;
    const c4W = 58;
    const x1 = margin;
    const x2 = x1 + c1W;
    const x3 = x2 + c2W;
    const x4 = x3 + c3W;

    // Row 2: SUBJECT | DATE
    drawCell(x1, curY, c1W, subjectRowH, null, 0.2, [120, 120, 120]);
    drawCell(x2, curY, c2W, subjectRowH, null, 0.2, [120, 120, 120]);
    drawCell(x3, curY, c3W, subjectRowH, null, 0.2, [120, 120, 120]);
    drawCell(x4, curY, c4W, subjectRowH, null, 0.2, [120, 120, 120]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('SUBJECT', x1 + 2, curY + 3.9);
    doc.setFont('helvetica', 'normal');
    doc.text(subjectLines, x2 + 2, curY + 3.9);

    doc.setFont('helvetica', 'bold');
    doc.text('DATE', x3 + 2, curY + 3.9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${eventDate}${eventTime ? ' (' + eventTime + ')' : ''}`, x4 + 2, curY + 3.9);
    curY += subjectRowH;

    // Row 3: DEPARTMENT | VENUE
    drawCell(x1, curY, c1W, rowH, null, 0.2, [120, 120, 120]);
    drawCell(x2, curY, c2W, rowH, null, 0.2, [120, 120, 120]);
    drawCell(x3, curY, c3W, rowH, null, 0.2, [120, 120, 120]);
    drawCell(x4, curY, c4W, rowH, null, 0.2, [120, 120, 120]);

    doc.setFont('helvetica', 'bold');
    doc.text('DEPARTMENT', x1 + 2, curY + 3.9);
    doc.setFont('helvetica', 'normal');
    doc.text(String(eventDept), x2 + 2, curY + 3.9);

    doc.setFont('helvetica', 'bold');
    doc.text('VENUE', x3 + 2, curY + 3.9);
    doc.setFont('helvetica', 'normal');
    doc.text(String(eventVenue), x4 + 2, curY + 3.9);
    curY += rowH;

    // Row 4: TRAINING TYPE | ROOM
    drawCell(x1, curY, c1W, rowH, null, 0.2, [120, 120, 120]);
    drawCell(x2, curY, c2W, rowH, null, 0.2, [120, 120, 120]);
    drawCell(x3, curY, c3W, rowH, null, 0.2, [120, 120, 120]);
    drawCell(x4, curY, c4W, rowH, null, 0.2, [120, 120, 120]);

    doc.setFont('helvetica', 'bold');
    doc.text('TRAINING TYPE', x1 + 2, curY + 3.9);
    doc.setFont('helvetica', 'normal');
    doc.text(String(trainingTypeVal), x2 + 2, curY + 3.9);

    doc.setFont('helvetica', 'bold');
    doc.text('ROOM', x3 + 2, curY + 3.9);
    doc.setFont('helvetica', 'normal');
    doc.text(String(eventRoom), x4 + 2, curY + 3.9);
  };

  // Function to draw Bottom Sign-Off Block (Chairperson/Instructor + Remarks + Administrator) & Footer
  const drawPageBottomAndFooter = (startY) => {
    let curY = startY;
    const hdrH = 5.4;
    const chairRowH = 5.4;

    // Columns for Chairperson/Instructor: 66 | 26 | 38 | 52 (Total = 182)
    const c1W = 66;
    const c2W = 26;
    const c3W = 38;
    const c4W = 52;
    const x1 = margin;
    const x2 = x1 + c1W;
    const x3 = x2 + c2W;
    const x4 = x3 + c3W;

    // 1. CHAIRPERSON/INSTRUCTOR Header
    drawCell(x1, curY, c1W, hdrH, [217, 217, 217], 0.2, [120, 120, 120]);
    drawCell(x2, curY, c2W, hdrH, [217, 217, 217], 0.2, [120, 120, 120]);
    drawCell(x3, curY, c3W, hdrH, [217, 217, 217], 0.2, [120, 120, 120]);
    drawCell(x4, curY, c4W, hdrH, [217, 217, 217], 0.2, [120, 120, 120]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text('CHAIRPERSON/INSTRUCTOR', x1 + c1W / 2, curY + 3.8, { align: 'center' });
    doc.text('ID NO.', x2 + c2W / 2, curY + 3.8, { align: 'center' });
    doc.text('LOA NO.', x3 + c3W / 2, curY + 3.8, { align: 'center' });
    doc.text('SIGNATURE', x4 + c4W / 2, curY + 3.8, { align: 'center' });
    curY += hdrH;

    // Prepare up to 3 leader rows
    const leadersList = (Array.isArray(event.leaderDetails) && event.leaderDetails.length > 0)
      ? event.leaderDetails
      : [{
          name: (event.leaderName && event.leaderName !== 'Unassigned') ? event.leaderName : '',
          staff_id: event.assignedId || '',
          loa_no: event.leaderLoa || ''
        }];

    const chairRowsTopY = curY;
    for (let r = 0; r < 3; r++) {
      const fill = r === 1 ? [246, 246, 246] : [255, 255, 255];
      drawCell(x1, curY, c1W, chairRowH, fill, 0.2, [120, 120, 120]);
      drawCell(x2, curY, c2W, chairRowH, fill, 0.2, [120, 120, 120]);
      drawCell(x3, curY, c3W, chairRowH, fill, 0.2, [120, 120, 120]);
      drawCell(x4, curY, c4W, chairRowH, fill, 0.2, [120, 120, 120]);

      const ldr = leadersList[r];
      if (ldr) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(0, 0, 0);
        doc.text(String(ldr.name || ''), x1 + c1W / 2, curY + 3.8, { align: 'center' });
        doc.text(String(ldr.staff_id || ''), x2 + c2W / 2, curY + 3.8, { align: 'center' });
        doc.text(String(ldr.loa_no || ''), x3 + c3W / 2, curY + 3.8, { align: 'center' });
      }
      curY += chairRowH;
    }

    // Draw Chairperson/Instructor QR Signature centered in the 3-row SIGNATURE area
    if (event.leader_signature) {
      try {
        const sigSize = 14.2;
        const sigX = x4 + (c4W - sigSize) / 2;
        const sigY = chairRowsTopY + (chairRowH * 3 - sigSize) / 2;
        doc.setFillColor(255, 255, 255);
        doc.rect(sigX - 0.6, sigY - 0.4, sigSize + 1.2, sigSize + 0.8, 'F');
        doc.addImage(event.leader_signature, 'PNG', sigX, sigY, sigSize, sigSize);
      } catch (e) {}
    }

    // 2. REMARKS Section (Contiguous below Chairperson/Instructor)
    drawCell(margin, curY, contentWidth, hdrH, [217, 217, 217], 0.2, [120, 120, 120]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('REMARKS', margin + contentWidth / 2, curY + 3.8, { align: 'center' });
    curY += hdrH;

    const remarksBoxH = 11.5;
    drawCell(margin, curY, contentWidth, remarksBoxH, [255, 255, 255], 0.2, [120, 120, 120]);
    if (event.remarks) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      const splitRem = doc.splitTextToSize(String(event.remarks), contentWidth - 6);
      doc.text(splitRem.slice(0, 3), margin + 3, curY + 4);
    }
    curY += remarksBoxH;

    // 3. ADMINISTRATOR Section (Contiguous below Remarks)
    const a1W = 66;
    const a2W = 64;
    const a3W = 52;
    const ax1 = margin;
    const ax2 = ax1 + a1W;
    const ax3 = ax2 + a2W;

    drawCell(ax1, curY, a1W, hdrH, [217, 217, 217], 0.2, [120, 120, 120]);
    drawCell(ax2, curY, a2W, hdrH, [217, 217, 217], 0.2, [120, 120, 120]);
    drawCell(ax3, curY, a3W, hdrH, [217, 217, 217], 0.2, [120, 120, 120]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text("ADMINISTRATOR'S NAME", ax1 + a1W / 2, curY + 3.8, { align: 'center' });
    doc.text('ID NO.', ax2 + a2W / 2, curY + 3.8, { align: 'center' });
    doc.text('SIGNATURE', ax3 + a3W / 2, curY + 3.8, { align: 'center' });
    curY += hdrH;

    const adminRowH = 11.5;
    drawCell(ax1, curY, a1W, adminRowH, [255, 255, 255], 0.2, [120, 120, 120]);
    drawCell(ax2, curY, a2W, adminRowH, [255, 255, 255], 0.2, [120, 120, 120]);
    drawCell(ax3, curY, a3W, adminRowH, [255, 255, 255], 0.2, [120, 120, 120]);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(String(adminName), ax1 + a1W / 2, curY + 6.8, { align: 'center' });
    doc.text(String(adminStaffId), ax2 + a2W / 2, curY + 6.8, { align: 'center' });

    if (adminSigDataUrl) {
      try {
        const aSigSize = 10.2;
        const aSigX = ax3 + (a3W - aSigSize) / 2;
        const aSigY = curY + (adminRowH - aSigSize) / 2;
        doc.addImage(adminSigDataUrl, 'PNG', aSigX, aSigY, aSigSize, aSigSize);
      } catch (e) {}
    }

    // 4. Bottom Page Footer ("Jan 2024" left, "IAA/FOP/F/002 Rev.01" right)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Jan 2024', margin, pageHeight - 9);
    doc.text('IAA/FOP/F/002 Rev.01', pageWidth - margin, pageHeight - 9, { align: 'right' });
  };

  // 3. Build 20-row-per-page Participant Table matching IAA/FOP/F/002 Rev.01 columns
  const rowsPerPage = 20;
  const rowCount = Math.max(rowsPerPage, Math.ceil((participants?.length || 0) / rowsPerPage) * rowsPerPage);
  const tableRows = [];

  for (let i = 0; i < rowCount; i++) {
    const p = participants[i];
    tableRows.push({
      no: p ? (i + 1) : '',
      name: p ? (p.name || '') : '',
      staffId: p ? (p.staffId || p.staff_id || '') : '',
      rank: p ? (p.rank || '') : '',
      license: p ? (p.license || p.license_no || '') : '',
      hub: p ? (p.hub || '') : '',
      signature: '',
      rawSig: p ? p.signature : null
    });
  }

  const tableColumns = [
    { header: 'NO', dataKey: 'no' },
    { header: 'N A M E', dataKey: 'name' },
    { header: 'ID NO.', dataKey: 'staffId' },
    { header: 'RANK', dataKey: 'rank' },
    { header: 'LICENSE\n/FAC NO.', dataKey: 'license' },
    { header: 'HUB', dataKey: 'hub' },
    { header: 'SIGNATURE', dataKey: 'signature' }
  ];

  autoTable(doc, {
    startY: tableStartY,
    columns: tableColumns,
    body: tableRows,
    theme: 'grid',
    margin: { top: tableStartY, left: margin, right: margin, bottom: 79 },
    styles: {
      font: 'helvetica',
      fontSize: 7.4,
      cellPadding: 1.0,
      valign: 'middle',
      halign: 'center',
      lineColor: [120, 120, 120],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      fillColor: [255, 255, 255],
      minCellHeight: 6.95
    },
    alternateRowStyles: {
      fillColor: [246, 246, 246]
    },
    headStyles: {
      fillColor: [217, 217, 217],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 7.5,
      lineColor: [120, 120, 120],
      lineWidth: 0.2,
      minCellHeight: 8.4
    },
    columnStyles: {
      no: { cellWidth: 11, halign: 'center' },
      name: { cellWidth: 59, halign: 'left' },
      staffId: { cellWidth: 24, halign: 'center' },
      rank: { cellWidth: 19, halign: 'center' },
      license: { cellWidth: 25, halign: 'center' },
      hub: { cellWidth: 15, halign: 'center' },
      signature: { cellWidth: 29, halign: 'center' }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.dataKey === 'signature') {
        const rowData = data.row.raw;
        if (rowData && rowData.rawSig) {
          try {
            const dim = Math.min(data.cell.width, data.cell.height) - 0.8;
            const xOffset = data.cell.x + (data.cell.width - dim) / 2;
            const yOffset = data.cell.y + (data.cell.height - dim) / 2;
            doc.addImage(rowData.rawSig, 'PNG', xOffset, yOffset, dim, dim);
          } catch (e) {}
        }
      }
    }
  });

  // 4. Draw Header, Info Grid, Bottom Sign-Off Block, and Footer on every page
  const totalPages = doc.internal.getNumberOfPages();
  const bottomBlockY = 219.2;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawPageHeaderAndInfo(p, totalPages);
    drawPageBottomAndFooter(bottomBlockY);
  }

  const safeSubject = (eventSubject || 'Event').replace(/[^a-z0-9]/gi, '_').slice(0, 35);
  const fileName = `IAA_Attendance_${safeSubject}_${eventDate || 'Record'}.pdf`;
  doc.save(fileName);
};
