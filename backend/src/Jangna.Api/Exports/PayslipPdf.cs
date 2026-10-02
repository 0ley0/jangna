using System.Globalization;
using Jangna.Core.Entities;
using Jangna.Payroll.Engine.Model;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Jangna.Api.Exports;

/// <summary>
/// สลิปเงินเดือน PDF (A5 คนละหน้า) ด้วย QuestPDF — สี/ฟอนต์ตามดีไซน์ Hearth (Noto Sans Thai + Noto Sans สำหรับตัวละติน)
/// QuestPDF Community license ใช้ฟรีได้ถ้ารายได้บริษัท &lt; 1 ล้าน USD/ปี — เกินแล้วต้องซื้อ license
/// </summary>
public static class PayslipPdf
{
    public sealed record Slip(
        string EmployerName, string? EmployerAddress, string? EmployerTaxId,
        string EmployeeName, string? NationalId, PayType PayType, bool IsFreelance,
        DateOnly PeriodStart, DateOnly PeriodEnd, DateOnly PayDate,
        IReadOnlyList<PayLine> Lines, decimal Gross, decimal Net, decimal SocialSecurityEmployer,
        decimal YtdIncome, decimal YtdTax, decimal YtdSocialSecurity, bool English);

    private const string Ink = "#2A2520";
    private const string Muted = "#736350"; // ตรงกับ --muted-foreground ของเว็บ (AA)
    private const string Hairline = "#E6D9BF";
    private const string Cream = "#FAF6EF";
    private const string Brand = "#C97B5D";
    private const string BrandInk = "#8E4A30";
    private const string BrandSoft = "#FBE6D7";

    private static readonly Lock InitLock = new();
    private static bool _initialized;

    /// <summary>ลงทะเบียน license + ฟอนต์ครั้งเดียว (ฟอนต์ฝังใน assembly — ดู Jangna.Api.csproj)</summary>
    private static void EnsureInitialized()
    {
        lock (InitLock)
        {
            if (_initialized) return;
            QuestPDF.Settings.License = LicenseType.Community;
            var assembly = typeof(PayslipPdf).Assembly;
            foreach (var name in assembly.GetManifestResourceNames().Where(n => n.EndsWith(".ttf", StringComparison.Ordinal)))
            {
                using var stream = assembly.GetManifestResourceStream(name)!;
                QuestPDF.Drawing.FontManager.RegisterFontFromStream(stream);
            }
            _initialized = true;
        }
    }

    public static byte[] Render(IReadOnlyList<Slip> slips)
    {
        EnsureInitialized();
        return Document.Create(doc =>
        {
            foreach (var slip in slips) doc.Page(page => Page(page, slip));
        }).GeneratePdf();
    }

    private static void Page(PageDescriptor page, Slip s)
    {
        string T(string th, string en) => s.English ? en : th;
        var culture = CultureInfo.GetCultureInfo(s.English ? "en-GB" : "th-TH");
        string Date(DateOnly d) => s.English
            ? d.ToString("d MMM yyyy", culture)
            : $"{d.Day} {culture.DateTimeFormat.AbbreviatedMonthNames[d.Month - 1]} {d.Year + 543}";

        page.Size(PageSizes.A5);
        page.Margin(28);
        page.PageColor(Colors.White);
        page.DefaultTextStyle(x => x.FontFamily("Noto Sans", "Noto Sans Thai").FontSize(9).FontColor(Ink));

        page.Header().PaddingBottom(12).BorderBottom(1).BorderColor(Hairline).Row(row =>
        {
            row.RelativeItem().Column(c =>
            {
                c.Item().Text(s.EmployerName).Bold().FontSize(13);
                if (!string.IsNullOrWhiteSpace(s.EmployerAddress)) c.Item().Text(s.EmployerAddress).FontColor(Muted).FontSize(8);
                if (!string.IsNullOrWhiteSpace(s.EmployerTaxId))
                    c.Item().Text($"{T("เลขประจำตัวผู้เสียภาษี", "Tax ID")} {s.EmployerTaxId}").FontColor(Muted).FontSize(8);
            });
            row.ConstantItem(120).AlignRight().Column(c =>
            {
                c.Item().AlignRight().Text(s.IsFreelance ? T("ใบแจ้งค่าจ้าง", "Payment advice") : T("สลิปเงินเดือน", "Payslip"))
                    .Bold().FontSize(13).FontColor(Brand);
                c.Item().AlignRight().Text($"{T("วันที่จ่าย", "Paid on")} {Date(s.PayDate)}").FontSize(8).FontColor(Muted);
            });
        });

        page.Content().PaddingTop(12).Column(col =>
        {
            col.Spacing(10);

            col.Item().Background(Cream).Border(1).BorderColor(Hairline).Padding(10).Row(row =>
            {
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text(T("พนักงาน", "Employee")).FontSize(7.5f).FontColor(Muted);
                    c.Item().Text(s.EmployeeName).Bold().FontSize(11);
                    if (!string.IsNullOrWhiteSpace(s.NationalId)) c.Item().Text(Mask(s.NationalId)).FontSize(8).FontColor(Muted);
                });
                row.RelativeItem().AlignRight().Column(c =>
                {
                    c.Item().AlignRight().Text(T("รอบจ่าย", "Pay period")).FontSize(7.5f).FontColor(Muted);
                    c.Item().AlignRight().Text($"{Date(s.PeriodStart)} – {Date(s.PeriodEnd)}").Bold();
                    c.Item().AlignRight().Text(PayTypeText(s.PayType, s.English)).FontSize(8).FontColor(Muted);
                });
            });

            var earnings = s.Lines.Where(l => l.Kind == LineKind.Earning).ToList();
            var deductions = s.Lines.Where(l => l.Kind == LineKind.Deduction).ToList();

            col.Item().Row(row =>
            {
                row.Spacing(10);
                row.RelativeItem().Element(e => LineTable(e, T("รายได้", "Earnings"), earnings, s.English, culture));
                row.RelativeItem().Element(e => LineTable(e, T("รายการหัก", "Deductions"), deductions, s.English, culture));
            });

            col.Item().Background(BrandSoft).Padding(10).Row(row =>
            {
                row.RelativeItem().Column(c =>
                {
                    c.Item().Text($"{T("รวมรายได้", "Total earnings")}  {Money(earnings.Sum(l => l.Amount))}").FontColor(BrandInk);
                    c.Item().Text($"{T("รวมรายการหัก", "Total deductions")}  {Money(deductions.Sum(l => l.Amount))}").FontColor(BrandInk);
                });
                row.ConstantItem(150).AlignRight().Column(c =>
                {
                    c.Item().AlignRight().Text(T("รับสุทธิ", "Net pay")).FontColor(BrandInk);
                    c.Item().AlignRight().Text($"{Money(s.Net)} {T("บาท", "THB")}").Bold().FontSize(15).FontColor(BrandInk);
                });
            });

            if (!s.IsFreelance)
            {
                col.Item().Border(1).BorderColor(Hairline).Padding(8).Row(row =>
                {
                    void Ytd(string label, decimal value) => row.RelativeItem().Column(c =>
                    {
                        c.Item().Text(label).FontSize(7.5f).FontColor(Muted);
                        c.Item().Text(Money(value)).Bold();
                    });
                    Ytd(T($"เงินได้สะสมปี {s.PayDate.Year + 543}", $"Income YTD {s.PayDate.Year}"), s.YtdIncome);
                    Ytd(T("ภาษีสะสม", "Tax YTD"), s.YtdTax);
                    Ytd(T("ประกันสังคมสะสม", "Social security YTD"), s.YtdSocialSecurity);
                    if (s.SocialSecurityEmployer > 0) Ytd(T("นายจ้างสมทบรอบนี้", "Employer SSO (this run)"), s.SocialSecurityEmployer);
                });
            }
        });

        page.Footer().AlignCenter().Text(T("ออกโดยระบบจ้างนะ — เอกสารนี้ออกจากระบบคอมพิวเตอร์ ไม่ต้องลงนาม",
            "Issued by Jangna — computer-generated, no signature required")).FontSize(7).FontColor(Muted);
    }

    private static void LineTable(IContainer container, string title, List<PayLine> lines, bool english, CultureInfo culture)
    {
        container.Column(c =>
        {
            c.Item().PaddingBottom(4).BorderBottom(1).BorderColor(Hairline).Text(title).Bold().FontColor(Muted).FontSize(8);
            if (lines.Count == 0) c.Item().PaddingTop(4).Text("—").FontColor(Muted);
            foreach (var line in lines)
            {
                c.Item().PaddingVertical(3).BorderBottom(0.5f).BorderColor(Hairline).Row(row =>
                {
                    row.RelativeItem().Column(d =>
                    {
                        d.Item().Text(PayLineLabels.Describe(line, english));
                        if (ShowQuantity(line))
                            d.Item().Text($"{line.Quantity.ToString("0.##", culture)} × {Money(line.Rate)}").FontSize(7).FontColor(Muted);
                    });
                    row.ConstantItem(62).AlignRight().Text(Money(line.Amount));
                });
            }
        });
    }

    /// <summary>แสดง จำนวน × อัตรา เฉพาะรายการที่มีความหมาย (ไม่ใช่รายการ 1 × ยอดเงิน)</summary>
    private static bool ShowQuantity(PayLine line) => line.Quantity != 1 && line.Quantity != 0;

    private static string Money(decimal v) => v.ToString("#,##0.00", CultureInfo.InvariantCulture);

    /// <summary>1-2345-67890-12-3 → x-xxxx-xxxxx-12-3 (กันข้อมูลส่วนตัวรั่วถ้าสลิปหลุด)</summary>
    private static string Mask(string id) => id.Length == 13 ? $"x-xxxx-xxxxx-{id[10..12]}-{id[12]}" : id;

    private static string PayTypeText(PayType type, bool english) => (type, english) switch
    {
        (PayType.Monthly, false) => "รายเดือน",
        (PayType.Daily, false) => "รายวัน",
        (PayType.Hourly, false) => "รายชั่วโมง",
        (PayType.Piece, false) => "ต่อชิ้น",
        (PayType.Monthly, true) => "Monthly",
        (PayType.Daily, true) => "Daily",
        (PayType.Hourly, true) => "Hourly",
        _ => "Per piece",
    };
}
