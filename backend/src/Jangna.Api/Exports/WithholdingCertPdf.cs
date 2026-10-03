using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Jangna.Api.Exports;

/// <summary>
/// หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) สรุปทั้งปี คนละหน้า A4 — เนื้อหาตามแบบ 50 ทวิ แต่จัดหน้าเอง ไม่ใช่แบบฟอร์มพิมพ์ทับ
/// ลูกจ้าง = เงินได้ 40(1) · ฟรีแลนซ์ = ค่าจ้างทำของ/บริการ หัก 3% (ดู docs/payroll.md)
/// </summary>
public static class WithholdingCertPdf
{
    public sealed record Cert(
        string PayerName, string? PayerAddress, string PayerTaxId,
        string PayeeName, string PayeeNationalId, string PayeeAddress, bool IsFreelance,
        int Year, DateOnly LastPaidDate, decimal Paid, decimal Tax, decimal SocialSecurity, int Number);

    private const string Ink = "#2A2520";
    private const string Muted = "#736350";
    private const string Hairline = "#E6D9BF";
    private const string Cream = "#FAF6EF";
    private const string Brand = "#C97B5D";

    public static byte[] Render(IReadOnlyList<Cert> certs)
    {
        PayslipPdf.EnsureInitialized();
        return Document.Create(doc =>
        {
            foreach (var c in certs) doc.Page(page => Page(page, c));
        }).GeneratePdf();
    }

    private static void Page(PageDescriptor page, Cert c)
    {
        var th = CultureInfo.GetCultureInfo("th-TH");
        page.Size(PageSizes.A4);
        page.Margin(40);
        page.PageColor(Colors.White);
        page.DefaultTextStyle(x => x.FontFamily("Noto Sans", "Noto Sans Thai").FontSize(10).FontColor(Ink));

        page.Header().PaddingBottom(10).BorderBottom(1).BorderColor(Hairline).Row(row =>
        {
            row.RelativeItem().Column(col =>
            {
                col.Item().Text("หนังสือรับรองการหักภาษี ณ ที่จ่าย").Bold().FontSize(16).FontColor(Brand);
                col.Item().Text("ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร").FontColor(Muted);
            });
            row.ConstantItem(110).AlignRight().Column(col =>
            {
                col.Item().AlignRight().Text($"เล่มที่ - เลขที่ {c.Number}").FontColor(Muted);
                col.Item().AlignRight().Text($"ปีภาษี {c.Year + 543}").Bold();
            });
        });

        page.Content().PaddingTop(14).Column(col =>
        {
            col.Spacing(12);
            col.Item().Element(e => Party(e, "ผู้มีหน้าที่หักภาษี ณ ที่จ่าย", c.PayerName, c.PayerTaxId, c.PayerAddress));
            col.Item().Element(e => Party(e, "ผู้ถูกหักภาษี ณ ที่จ่าย", c.PayeeName, c.PayeeNationalId, c.PayeeAddress));

            col.Item().Text(c.IsFreelance ? "ภ.ง.ด.3 (ผู้รับเป็นบุคคลธรรมดา — เงินได้ไม่ใช่เงินเดือน)" : "ภ.ง.ด.1ก (เงินเดือน ค่าจ้าง)")
                .FontColor(Muted);

            col.Item().Table(table =>
            {
                table.ColumnsDefinition(d =>
                {
                    d.RelativeColumn(4);
                    d.RelativeColumn(2);
                    d.RelativeColumn(2);
                    d.RelativeColumn(2);
                });
                void Head(string s) => table.Cell().Background(Cream).Border(0.5f).BorderColor(Hairline).Padding(6).Text(s).Bold().FontSize(9);
                void Cell(string s, bool right = false)
                {
                    var cell = table.Cell().Border(0.5f).BorderColor(Hairline).Padding(6);
                    (right ? cell.AlignRight() : cell).Text(s);
                }

                Head("ประเภทเงินได้พึงประเมินที่จ่าย");
                Head("วันที่จ่าย (ล่าสุด)");
                Head("จำนวนเงินที่จ่ายทั้งปี");
                Head("ภาษีที่หักและนำส่ง");

                Cell(c.IsFreelance ? "ค่าจ้างทำของ/บริการ" : "40(1) เงินเดือน ค่าจ้าง");
                Cell($"{c.LastPaidDate.Day} {th.DateTimeFormat.AbbreviatedMonthNames[c.LastPaidDate.Month - 1]} {c.LastPaidDate.Year + 543}");
                Cell(Money(c.Paid), right: true);
                Cell(Money(c.Tax), right: true);

                table.Cell().ColumnSpan(2).Border(0.5f).BorderColor(Hairline).Padding(6).Text("รวมเงินที่จ่ายและภาษีที่หักนำส่ง").Bold();
                table.Cell().Border(0.5f).BorderColor(Hairline).Padding(6).AlignRight().Text(Money(c.Paid)).Bold();
                table.Cell().Border(0.5f).BorderColor(Hairline).Padding(6).AlignRight().Text(Money(c.Tax)).Bold();
            });

            if (!c.IsFreelance)
                col.Item().Text($"เงินสมทบกองทุนประกันสังคม (ส่วนลูกจ้าง): {Money(c.SocialSecurity)} บาท").FontColor(Muted);
            col.Item().Text("ผู้จ่ายเงิน: หัก ณ ที่จ่าย").FontColor(Muted);
        });

        page.Footer().AlignCenter().Text("ออกโดยระบบจ้างนะ — เอกสารนี้ออกจากระบบคอมพิวเตอร์ ผู้จ่ายเงินตรวจสอบและลงนามก่อนส่งมอบ")
            .FontSize(8).FontColor(Muted);
    }

    private static void Party(IContainer container, string title, string name, string taxId, string? address)
    {
        container.Background(Cream).Border(1).BorderColor(Hairline).Padding(10).Column(c =>
        {
            c.Item().Text(title).FontSize(8.5f).FontColor(Muted);
            c.Item().Text(name).Bold().FontSize(12);
            c.Item().Text($"เลขประจำตัวผู้เสียภาษีอากร {taxId}");
            if (!string.IsNullOrWhiteSpace(address)) c.Item().Text(address).FontColor(Muted);
        });
    }

    private static string Money(decimal v) => v.ToString("#,##0.00", CultureInfo.InvariantCulture);
}
