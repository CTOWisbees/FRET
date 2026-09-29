'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { Printer, Download, FileText, ArrowLeft, RefreshCw } from 'lucide-react';
import { api, getApiUrl } from '@/lib/api';
import JsBarcode from 'jsbarcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function EmployeeIdCardRoute({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingImage, setDownloadingImage] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);

  const fetchIdCard = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/employee/${resolvedParams.id}/id-card`);
      if (res.data?.employee) {
        setEmployee(res.data.employee);
      } else {
        const meRes = await api.get('/api/employee/me');
        if (meRes.data?.authenticated) {
          setEmployee(meRes.data);
        }
      }
    } catch (err) {
      console.error('Failed to load ID card:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdCard();
  }, [resolvedParams.id]);

  useEffect(() => {
    if (barcodeRef.current && employee) {
      try {
        const barcodeVal = `WB${1000 + (employee.id || 1)}`;
        JsBarcode(barcodeRef.current, barcodeVal, {
          format: 'CODE128',
          displayValue: false,
          lineColor: '#000000',
          width: 1.5,
          height: 38,
          margin: 0,
        });
      } catch (e) {
        console.error('Barcode render error:', e);
      }
    }
  }, [employee]);

  const handlePrint = async () => {
    if (!cardRef.current) {
      window.print();
      return;
    }

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>ID Card - ${employee?.name || 'Employee'}</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 20mm;
              }
              body {
                margin: 0;
                padding: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 80vh;
                background: #ffffff;
              }
              .card-container {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
              }
              img {
                max-width: 320px;
                height: auto;
                display: block;
              }
            </style>
          </head>
          <body>
            <div class="card-container">
              <img src="${imgData}" />
            </div>
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 2000);
      }, 400);
    } catch (e) {
      console.error('Print error:', e);
      window.print();
    }
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setDownloadingImage(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      const imageURL = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imageURL;
      const empName = (employee?.name || 'employee').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `${empName}_id_card.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download image error:', err);
    } finally {
      setDownloadingImage(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!cardRef.current) return;
    setDownloadingPdf(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [85.6, 125],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, 85.6, 125);
      const empName = (employee?.name || 'employee').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      pdf.save(`${empName}_id_card.pdf`);
    } catch (err) {
      console.error('Download PDF error:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const phoneNum = employee?.phone || '8260770510';
  const formattedPhone = phoneNum.startsWith('+') ? phoneNum : `+91 ${phoneNum}`;

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-[#0F172A] p-4 sm:p-8 flex flex-col items-center justify-center font-sans antialiased">
      {/* Action Bar */}
      <div className="w-full max-w-md mb-6 flex flex-wrap items-center justify-between gap-3 no-print">
        <Link
          href="/profile"
          className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Profile</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={downloadingImage}
            className="px-3.5 py-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {downloadingImage ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Image</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="px-3.5 py-2 bg-[#0E9F6E] hover:bg-[#0A7A54] text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {downloadingPdf ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* ID Card Outer Frame with shadow & border */}
      <div id="idCardPrintArea" className="p-2.5 bg-white border-8 border-[#E2E8F0] rounded-[36px] shadow-2xl inline-block">
        <div 
          ref={cardRef}
          id="idCard"
          className="w-[330px] bg-white text-[#0F172A] rounded-[26px] overflow-hidden flex flex-col items-center text-center font-sans"
        >
          {/* Top Grey Header with WisBees Logo & Tagline */}
          <div className="w-full bg-[#F1F3F5] pt-5 pb-9 px-4 rounded-b-[14px] flex flex-col items-center justify-center">
            <img 
              src="/logo.png" 
              alt="WisBees Logo" 
              className="h-10 object-contain mx-auto" 
            />
            <div className="text-[12px] font-bold text-[#000000] tracking-wide mt-1">
              Creating an impact
            </div>
          </div>

          {/* Profile Photo Overlapping Header with Custom Orange Border */}
          <div className="-mt-8 z-10 flex justify-center">
            {employee?.avatar_url || employee?.has_photo ? (
              <img 
                src={getApiUrl(employee.avatar_url || `/employee/${employee.id}/avatar`)}
                alt={employee?.name}
                crossOrigin="anonymous"
                className="w-28 h-28 rounded-full object-cover border-[4px] border-[#F28500] shadow-md bg-white mx-auto"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#6366F1] text-white flex items-center justify-center font-extrabold text-4xl border-[4px] border-[#F28500] shadow-md mx-auto select-none">
                {employee?.name ? employee.name[0].toUpperCase() : 'C'}
              </div>
            )}
          </div>

          {/* Card Body Content */}
          <div className="w-full px-5 pt-3 pb-5 space-y-2.5 flex flex-col items-center">
            <h2 className="text-lg font-black tracking-wide uppercase text-[#000000] font-['Montserrat',sans-serif]">
              {employee?.name || 'CHHAYAKANTA MAHARANA'}
            </h2>

            {/* Bright Orange Designation Pill */}
            <div className="w-full px-4 py-2 bg-[#F28500] text-white rounded-2xl shadow-xs">
              <div className="text-xs font-bold leading-tight">
                {employee?.designation || 'IT Intern – Web & Automation Developer'}
              </div>
            </div>

            {/* Blood Group */}
            <div className="text-sm font-bold text-[#000000]">
              {employee?.blood_group || 'B+'}
            </div>

            {/* Contact Details */}
            <div className="text-xs text-[#000000] space-y-0.5 font-normal leading-relaxed text-left w-full px-2">
              <div>
                <span className="font-bold">E-mail:</span> {employee?.email || 'chhayakantamaharan@gmail.com'}
              </div>
              <div>
                <span className="font-bold">Phone:</span> {formattedPhone}
              </div>
            </div>

            {/* Real Code128 Barcode */}
            <div className="pt-2 flex flex-col items-center justify-center w-full">
              <svg ref={barcodeRef} id="barcodeSvg" className="max-w-[200px] h-[38px]"></svg>
              <div className="text-[9px] text-[#4A5568] font-medium tracking-wider mt-0.5">
                https://www.wisbees.com/
              </div>
            </div>

            {/* Bottom Most Organization Footer */}
            <div className="font-extrabold text-xs text-[#000000] font-['Montserrat',sans-serif] tracking-wide pt-1">
              Timearrow Pvt. Ltd
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
