
import pptxgen from "pptxgenjs";
import { SlideData } from "../types";

export async function generatePptx(slides: SlideData[], fileName?: string): Promise<Blob | void> {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';

  slides.forEach((slideData) => {
    const slide = pres.addSlide();
    
    const sortedElements = [...slideData.elements].sort((a, b) => a.y - b.y);

    sortedElements.forEach((el) => {
      const options: any = {
        x: `${el.x}%`,
        y: `${el.y}%`,
        w: `${el.w}%`,
        h: `${el.h}%`,
        fontSize: el.fontSize || 16,
        bold: !!el.isBold || el.type === 'title',
        color: el.color ? el.color.replace('#', '') : '000000',
        align: el.align || (el.type === 'title' ? 'center' : 'left'),
        valign: 'top',
        wrap: true,
        autoFit: true,
        shrinkText: true,
        fontFace: 'Arial',
        transparency: el.opacity !== undefined ? Math.round((1 - el.opacity) * 100) : 0,
      };

      if ((el.type === 'image' || el.type === 'branding_replacement') && el.imageData) {
        slide.addImage({
          data: el.imageData,
          x: options.x,
          y: options.y,
          w: options.w,
          h: options.h,
          sizing: { type: 'contain', w: '100%', h: '100%' },
          transparency: options.transparency
        });
      } else if (el.type === 'bullet_list') {
        const lines = (el.content as string).split('\n').filter(l => l.trim() !== '');
        slide.addText(
          lines.map(line => ({ 
            text: line.replace(/^[•\-*]\s?/, ''),
            options: { bullet: true, paraSpaceBefore: 0.1 } 
          })),
          options
        );
      } else if (el.type === 'title') {
        slide.addText(el.content as string, { ...options, fontSize: el.fontSize || 32, bold: true });
      } else {
        slide.addText(el.content as string, options);
      }
    });
  });

  if (fileName) {
    await pres.writeFile({ fileName });
  } else {
    return await pres.write('blob') as Blob;
  }
}
