
import { jsPDF } from "jspdf";

declare const pdfjsLib: any;

export async function convertPdfToImages(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const imageUrls: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    // Optimized scale 2.0 for balanced quality/size
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport: viewport }).promise;
    // Using JPEG 0.85 quality to keep output file size similar to the original input
    imageUrls.push(canvas.toDataURL('image/jpeg', 0.85));
  }

  return imageUrls;
}

export async function createPdfFromImages(imageDatas: string[], fileName: string): Promise<void> {
  if (imageDatas.length === 0) return;

  const img = new Image();
  await new Promise((resolve) => {
    img.onload = resolve;
    img.src = imageDatas[0];
  });

  const orientation = img.width > img.height ? 'l' : 'p';
  const doc = new jsPDF(orientation, 'px', [img.width, img.height]);

  for (let i = 0; i < imageDatas.length; i++) {
    if (i > 0) doc.addPage([img.width, img.height], orientation);
    doc.addImage(imageDatas[i], 'JPEG', 0, 0, img.width, img.height, undefined, 'FAST');
  }

  doc.save(fileName);
}