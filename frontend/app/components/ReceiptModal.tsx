"use client";

import { Printer, Download, Car, Shield, CheckCircle2, MapPin, Navigation, Sparkles } from "lucide-react";

interface ReceiptModalProps {
  isOpen: boolean;
  ride: {
    referenceId: string;
    pickup: string;
    destination: string;
    rideId?: string;
    rideName: string;
    seats: number;
    baseFare: number;
    distanceKm: number;
    platformFee: number;
    totalFare: number;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    razorpayOrderId?: string | null;
    razorpayPaymentId?: string | null;
    bookedAt: string;
    createdAt?: string;
    customerName?: string | null;
    customerEmail?: string | null;
    driver?: {
      name: string;
      car: string;
      rating: number;
      plate: string;
      phone?: string;
    };
  } | null;
  onClose: () => void;
}

export default function ReceiptModal({ isOpen, ride, onClose }: ReceiptModalProps) {
  if (!isOpen || !ride) return null;

  const invoiceNumber = `INV-${ride.referenceId}`;
  const invoiceDate = new Date(ride.createdAt || Date.now()).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const distanceFare = Math.round(
    ride.totalFare - ride.baseFare - (ride.platformFee || 25)
  );

  function handlePrint() {
    window.print();
  }

  function handleDownloadHtml() {
    if (!ride) return;
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SwiftRide Tax Invoice - ${ride?.referenceId}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #0f172a; max-width: 680px; margin: 0 auto; }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 24px; font-weight: 900; }
    .logo span { color: #eab308; }
    .badge { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: bold; }
    .meta { margin-top: 20px; display: flex; justify-content: space-between; font-size: 13px; }
    .section-title { font-size: 11px; text-transform: uppercase; font-weight: bold; color: #64748b; margin-top: 25px; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
    .route-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; font-size: 13px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th { text-align: left; padding: 8px 0; color: #64748b; font-size: 11px; text-transform: uppercase; }
    td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
    .total-row { font-weight: 900; font-size: 16px; border-top: 2px solid #0f172a; }
    .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Swift<span>Ride</span></div>
    <div>
      <span class="badge">OFFICIAL TRIP RECEIPT · PAID</span>
    </div>
  </div>
  <div class="meta">
    <div>
      <strong>Tax Invoice:</strong> ${invoiceNumber}<br/>
      <strong>Booking Reference:</strong> ${ride?.referenceId}<br/>
      <strong>Date:</strong> ${invoiceDate} at ${ride?.bookedAt}
    </div>
    <div style="text-align: right;">
      <strong>Rider:</strong> ${ride?.customerName || "SwiftRide Customer"}<br/>
      <strong>Email:</strong> ${ride?.customerEmail || "N/A"}<br/>
      <strong>Category:</strong> ${ride?.rideName}
    </div>
  </div>
  <div class="section-title">Trip &amp; Driver Details</div>
  <div class="route-box">
    <strong>Pickup:</strong> ${ride?.pickup}<br/>
    <strong>Destination:</strong> ${ride?.destination}<br/>
    <strong>Driver:</strong> ${ride?.driver?.name || "Rahul Sharma"} · ${ride?.driver?.car || "Maruti Dzire"} (${ride?.driver?.plate || "DL 01 AB 4291"})
  </div>
  <div class="section-title">Fare Breakdown</div>
  <table>
    <tr><th>Item Description</th><th style="text-align:right;">Amount (INR)</th></tr>
    <tr><td>Base Fare (${ride?.rideName})</td><td style="text-align:right;">₹${ride?.baseFare}.00</td></tr>
    <tr><td>Distance Fare (~${ride?.distanceKm} km)</td><td style="text-align:right;">₹${distanceFare}.00</td></tr>
    <tr><td>Platform &amp; Safety Service Fee</td><td style="text-align:right;">₹${ride?.platformFee || 25}.00</td></tr>
    <tr class="total-row"><td>Total Paid</td><td style="text-align:right; color:#eab308;">₹${ride?.totalFare}.00</td></tr>
  </table>
  <div class="section-title">Payment Audit</div>
  <div class="route-box">
    <strong>Method:</strong> ${String(ride?.paymentMethod || "").toLowerCase().includes("razorpay") ? "Razorpay Online (Test Mode)" : "Cash on Trip Completion"}<br/>
    <strong>Payment Status:</strong> ${String(ride?.paymentStatus || "PAID").toUpperCase()}<br/>
    ${ride?.razorpayPaymentId ? `<strong>Payment ID:</strong> ${ride.razorpayPaymentId}<br/>` : ""}
    ${ride?.razorpayOrderId ? `<strong>Order ID:</strong> ${ride.razorpayOrderId}<br/>` : ""}
  </div>
  <div class="footer">
    SwiftRide Mobility Technologies India Pvt. Ltd. · GSTIN: 07AABCS1429B1Z8<br/>
    This is a computer-generated tax invoice and does not require a physical signature.
  </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SwiftRide_Receipt_${ride.referenceId}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in print:p-0 print:bg-white print:fixed-none">
      {/* Print stylesheet */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt-modal,
          #printable-receipt-modal * {
            visibility: visible;
          }
          #printable-receipt-modal {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100% !important;
            margin: 0;
            padding: 20px;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        id="printable-receipt-modal"
        className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200"
      >
        {/* Receipt Header (Screen & Print) */}
        <div className="bg-slate-950 px-6 py-5 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400 text-slate-950">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                Official Trip Invoice
              </span>
              <h3 className="text-base font-black tracking-tight">{ride.referenceId}</h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              title="Print Receipt"
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadHtml}
              title="Download HTML Receipt"
              className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-yellow-300 transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Invoice Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[82vh] overflow-y-auto print:max-h-none print:overflow-visible">
          {/* Brand & Invoice Banner */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-5">
            <div>
              <span className="text-2xl font-black tracking-tight text-slate-950">
                Swift<span className="text-yellow-500">Ride</span>
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">Mobility Technologies India Pvt. Ltd.</p>
              <p className="font-mono text-[10px] text-slate-400">GSTIN: 07AABCS1429B1Z8</p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" /> PAID RECEIPT
              </span>
              <p className="font-mono text-xs font-bold text-slate-900 mt-2">{invoiceNumber}</p>
              <p className="text-[11px] text-slate-500">{invoiceDate} · {ride.bookedAt}</p>
            </div>
          </div>

          {/* Customer & Category */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Billed To
              </span>
              <p className="font-bold text-slate-900 mt-0.5">{ride.customerName || "Verified Rider"}</p>
              <p className="text-slate-600">{ride.customerEmail || "rider@swiftride.demo"}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Vehicle Category
              </span>
              <p className="font-bold text-slate-900 mt-0.5">{ride.rideName}</p>
              <p className="text-slate-600">{ride.seats} Passenger Capacity</p>
            </div>
          </div>

          {/* Route Card */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2.5 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Trip Details &amp; Route
            </span>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <MapPin className="h-2.5 w-2.5" />
              </div>
              <div>
                <span className="font-semibold text-slate-500 text-[11px]">Pickup: </span>
                <span className="font-bold text-slate-900">{ride.pickup}</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 text-yellow-400">
                <Navigation className="h-2.5 w-2.5" />
              </div>
              <div>
                <span className="font-semibold text-slate-500 text-[11px]">Drop-off: </span>
                <span className="font-bold text-slate-900">{ride.destination}</span>
              </div>
            </div>
          </div>

          {/* Driver Box */}
          {ride.driver && (
            <div className="rounded-2xl border border-slate-200 p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 text-slate-950 font-black">
                  {ride.driver.name?.[0] || "D"}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{ride.driver.name}</p>
                  <p className="text-[11px] text-slate-500">{ride.driver.car}</p>
                  <p className="font-mono text-[10px] text-slate-600 mt-0.5">{ride.driver.plate}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                  ★ {ride.driver.rating || 4.9}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">Verified Partner</p>
              </div>
            </div>
          )}

          {/* Itemized Price Table */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Itemized Tax Invoice Breakdown
            </span>
            <table className="w-full text-xs mt-2 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase">
                  <th className="py-2 text-left font-bold">Item Description</th>
                  <th className="py-2 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-2.5 font-medium">Base Fare ({ride.rideName})</td>
                  <td className="py-2.5 text-right font-mono font-semibold">₹{ride.baseFare}.00</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-medium">Distance Charge (~{ride.distanceKm} km)</td>
                  <td className="py-2.5 text-right font-mono font-semibold">₹{distanceFare}.00</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-medium">Platform &amp; Safety Tech Fee</td>
                  <td className="py-2.5 text-right font-mono font-semibold">₹{ride.platformFee || 25}.00</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-medium text-slate-500">Applicable GST / Taxes (5%)</td>
                  <td className="py-2.5 text-right font-mono text-slate-500">Included</td>
                </tr>
                <tr className="border-t-2 border-slate-950 font-black text-sm text-slate-950">
                  <td className="py-3">Total Paid Amount</td>
                  <td className="py-3 text-right text-base text-yellow-600 font-mono">
                    ₹{ride.totalFare}.00
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment Audit */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Channel:</span>
              <span className="font-bold text-slate-900">
                {String(ride.paymentMethod || "").toLowerCase().includes("razorpay") ? "Razorpay Online (Test Mode)" : "Cash on Trip Completion"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Status:</span>
              <span className="font-bold text-emerald-700">{String(ride.paymentStatus || "PAID").toUpperCase()}</span>
            </div>
            {ride.razorpayPaymentId && (
              <div className="flex justify-between font-mono text-[10px]">
                <span className="text-slate-400">Razorpay Payment ID:</span>
                <span className="text-slate-700 font-bold">{ride.razorpayPaymentId}</span>
              </div>
            )}
            {ride.razorpayOrderId && (
              <div className="flex justify-between font-mono text-[10px]">
                <span className="text-slate-400">Razorpay Order ID:</span>
                <span className="text-slate-700">{ride.razorpayOrderId}</span>
              </div>
            )}
          </div>

          {/* Footer Notice */}
          <div className="text-center text-[10px] text-slate-400 border-t border-slate-100 pt-4 leading-relaxed">
            SwiftRide Mobility Technologies India Pvt. Ltd. · 100% Verified Digital Invoice
            <br />
            For billing or ride inquiries, please contact support@swiftride.io with booking reference {ride.referenceId}.
          </div>
        </div>

        {/* Footer (Screen only) */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between no-print">
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Save HTML Receipt</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-950 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
