import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

export const exportAttendancePDF = async (event, participants, admin) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);

  // Helper to draw a border box
  const drawBox = (x, y, w, h) => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
  };

  const drawHeaderGrid = (pageNum, totalPagesPlaceholder) => {
    // --- TOP ROW ---
    const headerTop = margin;
    const headerHeight = 25;

    // Logo Box
    drawBox(margin, headerTop, 40, headerHeight);
    try {
      // Adjusted to be square and larger as requested (approx 22x22mm)
      doc.addImage('/icon.png', 'PNG', margin + 9, headerTop + 1.5, 22, 22);
    } catch (e) {
      // Fallback to text if logo fails to load
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(226, 22, 41);
      doc.text('AirAsia', margin + 20, headerTop + 14, { align: 'center' });
    }

    // Title Box
    drawBox(margin + 40, headerTop, 90, headerHeight);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Attendance List', margin + 40 + 45, headerTop + 15, { align: 'center' });

    // Info Box
    drawBox(margin + 130, headerTop, 60, headerHeight);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    // Extract numeric ID from EV-xxxx or similar and pad to 5 digits
    const rawId = event.event_code || '000';
    const numericId = rawId.replace(/\D/g, '').padStart(5, '0');

    // Determine Department Code dynamically based on official mapping
    const dept = (event.department || 'Flight Operation');
    let deptCode = 'FOP';
    if (dept === 'Engineering') deptCode = 'ENG';
    else if (dept === 'Cabin Crew') deptCode = 'CC';
    else if (dept === 'Ground Operations') deptCode = 'GND';
    else if (dept === 'Commercial') deptCode = 'COMM';
    else if (dept.includes('technology') || dept === 'ICT') deptCode = 'ICT';
    else if (dept === 'Facilities Management') deptCode = 'FM';
    else if (dept === 'Corporate Quality Assurance') deptCode = 'CQA';
    else if (dept === 'Safety') deptCode = 'SAF';
    else if (dept !== 'Flight Operation' && dept !== 'FOP') {
      // Fallback for any others
      deptCode = dept.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 3);
    }

    doc.text(`Rec. No.    :   IAA/${deptCode}/${event.type === 'Training' ? 'TRG' : 'MTG'}/${new Date().getFullYear()}/${numericId}`, margin + 132, headerTop + 6);
    doc.text(`Date          :   ${event.date}`, margin + 132, headerTop + 12);
    // Use placeholder for total pages to be replaced later
    doc.text(`Page         :   ${pageNum} of ${totalPagesPlaceholder}`, margin + 132, headerTop + 18);

    // --- INFO GRID ---
    let currentY = headerTop + headerHeight + 2;
    const gridHeight = 6;

    // Type Checkboxes
    drawBox(margin, currentY, contentWidth, gridHeight);
    doc.setFont('helvetica', 'bold');
    doc.text(`MEETING: ${event.type === 'Meeting' ? '[v]' : '[ ]'}`, margin + 50, currentY + 4, { align: 'center' });
    doc.text(`TRAINING: ${event.type === 'Training' ? '[v]' : '[ ]'}`, margin + 140, currentY + 4, { align: 'center' });

    currentY += gridHeight;

    // Subject | Date
    drawBox(margin, currentY, 100, gridHeight);
    doc.setFontSize(7);
    doc.text('SUBJECT', margin + 1, currentY + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(event.name.toUpperCase(), margin + 25, currentY + 4);

    drawBox(margin + 100, currentY, 90, gridHeight);
    doc.setFont('helvetica', 'bold');
    doc.text('DATE', margin + 101, currentY + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(event.date, margin + 125, currentY + 4);

    currentY += gridHeight;

    // Dept | Venue
    drawBox(margin, currentY, 100, gridHeight);
    doc.setFont('helvetica', 'bold');
    doc.text('DEPARTMENT', margin + 1, currentY + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(event.department?.toUpperCase() || '', margin + 25, currentY + 4);

    drawBox(margin + 100, currentY, 90, gridHeight);
    doc.setFont('helvetica', 'bold');
    doc.text('VENUE', margin + 101, currentY + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(event.venue?.toUpperCase() || '', margin + 125, currentY + 4);

    currentY += gridHeight;

    // Type | Room
    drawBox(margin, currentY, 100, gridHeight);
    doc.setFont('helvetica', 'bold');
    doc.text('TRAINING TYPE', margin + 1, currentY + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(event.type?.toUpperCase() || '', margin + 25, currentY + 4);

    drawBox(margin + 100, currentY, 90, gridHeight);
    doc.setFont('helvetica', 'bold');
    doc.text('ROOM', margin + 101, currentY + 4);
    doc.setFont('helvetica', 'normal');
    doc.text(event.room?.toUpperCase() || '', margin + 125, currentY + 4);

    return currentY + gridHeight + 2;
  };

  // Main table generation
  autoTable(doc, {
    startY: 65, // Increased from 60 to add spacing after header
    margin: { top: 65, left: margin, right: margin, bottom: 40 },
    head: [['NO', 'NAME', 'ID NO.', 'RANK', 'LICENSE / FAC NO.', 'HUB', 'SIGNATURE']],
    body: participants.map((p, i) => [
      i + 1,
      p.name.toUpperCase(),
      p.staffId,
      p.rank?.toUpperCase() || '',
      p.license || '',
      p.hub?.toUpperCase() || '',
      ''
    ]),
    theme: 'grid',
    headStyles: {
      fillColor: [220, 220, 220],
      textColor: [0, 0, 0],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: 0.1
    },
    styles: {
      fontSize: 7,
      textColor: [0, 0, 0],
      cellPadding: 2,
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 30, halign: 'center' },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 35, minCellHeight: 14 }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const p = participants[data.row.index];
        if (p.signature) {
          try {
            // QR is now square 12.5x12.5 for 35x35 feel
            doc.addImage(p.signature, 'PNG', data.cell.x + 11.25, data.cell.y + 0.75, 12.5, 12.5);
          } catch (e) { }
        }
      }
    },
    didDrawPage: (data) => {
      // Draw header on every page
      drawHeaderGrid(data.pageNumber, '{total_pages}');

      // Footer info
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text('Jan 2024', margin, pageHeight - 5);
      doc.text('IAA/FOP/F/002 Rev.01', pageWidth - margin, pageHeight - 5, { align: 'right' });
    }
  });

  // --- FOOTER SIGNATURES ---
  let currentY = doc.lastAutoTable.finalY + 5;

  // Add the Chairperson section
  const checkSpace = (heightNeeded) => {
    if (currentY + heightNeeded > pageHeight - 20) {
      doc.addPage();
      currentY = 60; // Start below header on new page
      return true;
    }
    return false;
  };

  checkSpace(30);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  drawBox(margin, currentY, contentWidth, 6);
  doc.text('CHAIRPERSON / INSTRUCTOR', margin + 30, currentY + 4, { align: 'center' });
  doc.text('ID NO.', margin + 100, currentY + 4, { align: 'center' });
  doc.text('LOA NO.', margin + 140, currentY + 4, { align: 'center' });
  doc.text('SIGNATURE', margin + 175, currentY + 4, { align: 'center' });

  currentY += 6;
  drawBox(margin, currentY, contentWidth, 20);
  if (event.leaderDetails && event.leaderDetails.length > 0) {
    const leader = event.leaderDetails[0];
    doc.setFont('helvetica', 'normal');
    doc.text(leader.name?.toUpperCase() || '', margin + 30, currentY + 11, { align: 'center' });
    doc.text(leader.staff_id || '', margin + 100, currentY + 11, { align: 'center' });
    doc.text(leader.loa_no || '', margin + 140, currentY + 11, { align: 'center' });

    if (event.leader_signature) {
      try {
        // Chairperson QR square 12.5x12.5
        doc.addImage(event.leader_signature, 'PNG', margin + 162.5, currentY + 3.75, 12.5, 12.5);
      } catch (e) { }
    }
  }

  currentY += 25; // Spacing after Chairperson box
  drawBox(margin, currentY, contentWidth, 6);
  doc.text('REMARKS', pageWidth / 2, currentY + 4, { align: 'center' });

  currentY += 6;
  drawBox(margin, currentY, contentWidth, 12);
  if (event.remarks) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    const splitRemarks = doc.splitTextToSize(event.remarks, contentWidth - 4);
    doc.text(splitRemarks, margin + 2, currentY + 4);
  }

  // Add the Administrator section
  currentY += 20; // Increased spacing after Remarks
  checkSpace(35);

  doc.setFont('helvetica', 'bold');
  drawBox(margin, currentY, contentWidth, 6);
  doc.text('ADMINISTRATOR\'S NAME', margin + 50, currentY + 4, { align: 'center' });
  doc.text('ID NO.', margin + 130, currentY + 4, { align: 'center' });
  doc.text('SIGNATURE', margin + 170, currentY + 4, { align: 'center' });

  currentY += 6;
  drawBox(margin, currentY, contentWidth, 20);

  if (admin) {
    doc.setFont('helvetica', 'normal');
    // Ensure both Name and Staff ID are shown in their respective columns
    doc.text(admin.name?.toUpperCase() || admin.full_name?.toUpperCase() || '', margin + 50, currentY + 10, { align: 'center' });
    doc.text(admin.staff_id || '', margin + 130, currentY + 10, { align: 'center' });

    // Generate Automated Admin QR Signature
    try {
      const adminVerification = `ADMINISTRATOR: ${admin.name || 'N/A'} (${admin.staff_id || 'N/A'}) | REPORT: ${event.event_code || 'N/A'} | DATE: ${new Date().toLocaleDateString()} | VERIFIED BY ATTENDSYNC`;
      const adminQr = await QRCode.toDataURL(adminVerification, { margin: 1, width: 100 });
      // Admin QR square 12.5x12.5
      doc.addImage(adminQr, 'PNG', margin + 162.5, currentY + 3.75, 12.5, 12.5);
    } catch (e) {
      console.error('Admin QR error:', e);
    }
  }

  // Final step: Replace total pages placeholder
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    // This is a simple way to replace text in jsPDF
    // Note: In a real production app we'd use doc.putTotalPages
    // but for this template text replacement is fine
    doc.setPage(i);
    // Re-draw the page number part specifically
    doc.setFillColor(255, 255, 255);
    doc.rect(margin + 131, margin + 15, 58, 6, 'F');
    doc.setTextColor(0);
    doc.text(`Page         :   ${i} of ${totalPages}`, margin + 132, margin + 18);
  }

  const fileName = `${event.type}_${event.name.replace(/\s+/g, '')}_${event.date}.pdf`;
  doc.save(fileName);
};
