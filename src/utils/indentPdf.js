import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export const generateIndentPDF = (order, items) => {
  return new Promise((resolve, reject) => {
    /* ---------- FILE SETUP ---------- */
    const indentDir = path.join("uploads", "indents");
    if (!fs.existsSync(indentDir)) {
      fs.mkdirSync(indentDir, { recursive: true });
    }

    const indentNo = order.indent_no; // e.g. KIET06022026/1

// 🔒 make filename safe for filesystem
const safeIndentNo = indentNo.replace(/[\/\\]/g, "-");

const fileName = `${safeIndentNo}.pdf`;
const filePath = path.join(indentDir, fileName);

//console.log("Saving PDF to:", filePath);// Check if file already exists


    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    /* ---------- HEADER ---------- */
    doc
      .fontSize(16)
      .text("KIET GROUP OF INSTITUTIONS", { align: "center" });
    doc
      .fontSize(13)
      .text("INVENTORY INDENT LETTER", { align: "center" });

    doc.moveDown(2);

    doc.fontSize(11);
    doc.text(`Indent No : ${indentNo}`);
    doc.text(`Staff Name : ${order.staff_name}`);
    doc.text(`Issued On : ${new Date().toLocaleString("en-GB")}`);

    doc.moveDown(1.5);

    /* ---------- TABLE HEADER ---------- */
    doc.font("Helvetica-Bold");
    doc.text("Product", 50, doc.y);
    doc.text("Quantity", 420, doc.y);
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

    doc.moveDown(0.5);
    doc.font("Helvetica");

    /* ---------- TABLE ROWS ---------- */
    items.forEach((item, index) => {
      doc.text(`${index + 1}. ${item.product_name}`, 50, doc.y);
      doc.text(item.quantity.toString(), 420, doc.y);
      doc.moveDown();
    });

    doc.moveDown(3);

    /* ---------- SIGNATURE & STAMP ---------- */
    // const signaturePath = path.resolve(
    //   "src/assets/signatures/inventory-admin.jpg"
    // );

    // const stampPath = path.resolve(
    //   "src/assets/stamps/kiet-stamp.jpg"
    // );

    // // Signature
    // if (fs.existsSync(signaturePath)) {
    //   doc.image(signaturePath, 60, doc.y, { width: 130 });
    // }

    // // Stamp
    // if (fs.existsSync(stampPath)) {
    //   doc.image(stampPath, 360, doc.y - 40, { width: 130 });
    // }

    // doc.moveDown(4);

    /* ---------- FOOTER TEXT ---------- */
    doc.fontSize(10);
    doc.text("Inventory Admin");
    doc.text("Inventory Department");
    doc.text("KIET Group of Institutions");

    doc.moveDown(1);
    doc
      .fontSize(8)
      .text(
        "This is a system-generated indent letter and is valid only with official signature and stamp.",
        { align: "center" }
      );

    doc.end();

    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
};
