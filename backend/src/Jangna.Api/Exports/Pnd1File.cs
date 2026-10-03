using System.Globalization;
using System.Text;

namespace Jangna.Api.Exports;

/// <summary>
/// ไฟล์ใบแนบ ภ.ง.ด.1 ตาม "รูปแบบข้อมูล (FORMAT กลาง) ภ.ง.ด.1 ภ.ง.ด.1ก และ ภ.ง.ด.1ก พิเศษ" Version 2.0 (16/06/2568) ของกรมสรรพากร
/// แถวแรก Header (H) ตามด้วย Detail (D) คนละแถว คั่นด้วย | (ไม่มี | หัวท้าย), UTF-8, CRLF
/// ตัวเลข 2 ตำแหน่งเสมอ (0.00), วันที่ ววดดปปปป (พ.ศ.), ข้อความห้ามมีอักขระ * + / \ ! $ % # &amp; @ , ' "
/// </summary>
public static class Pnd1File
{
    /// <summary>Month = 0 → ภ.ง.ด.1ก (สรุปทั้งปี) — สมมติฐาน: ใช้โครงเดียวกับ ภ.ง.ด.1 เปลี่ยนชนิดแบบเป็น PND1A และเดือนเป็น 00</summary>
    public sealed record Header(string TaxId, string BranchNo, int Year, int Month, string? RdUserId)
    {
        public bool Annual => Month == 0;
    }

    public sealed record Row(
        string NationalId, string Title, string FirstName, string LastName, DateOnly PaidDate, decimal PaidAmount, decimal Tax,
        string? AddressLine, string? Subdistrict, string District, string Province, string PostalCode);

    /// <summary>คำนำหน้าชื่อตามที่พิมพ์ในแบบ</summary>
    public static string TitleText(Core.Entities.Title? title) => title switch
    {
        Core.Entities.Title.Mr => "นาย",
        Core.Entities.Title.Mrs => "นาง",
        Core.Entities.Title.Miss => "นางสาว",
        _ => "-",
    };

    /// <summary>TAX_TYPE_NID_BRANCH_YEAR_MONTH_FORMTYPE_ครั้งที่ส่ง.txt</summary>
    public static string FileName(Header h) => $"{FormCode(h)}_{h.TaxId}_{h.BranchNo}_{h.Year + 543}_{h.Month:00}_00_00.txt";

    private static string FormCode(Header h) => h.Annual ? "PND1A" : "PND1";

    public static string Build(Header h, IReadOnlyList<Row> rows)
    {
        var totalPaid = rows.Sum(r => r.PaidAmount);
        var totalTax = rows.Sum(r => r.Tax);
        // มี User ID = ยื่นผ่านอินเทอร์เน็ต (2) ต้องระบุยอดชำระ, ไม่มี = ยื่นด้วยสื่อ/ฝากไฟล์ (1)
        var internet = !string.IsNullOrWhiteSpace(h.RdUserId);

        var sb = new StringBuilder();
        Line(sb,
            "H", "0000", h.TaxId, h.BranchNo, "1", FormCode(h), h.TaxId, h.BranchNo, "สำนักงานใหญ่", "0",
            $"{h.Month:00}", $"{h.Year + 543}", "", "00", rows.Count.ToString(CultureInfo.InvariantCulture),
            Money(totalPaid), Money(totalTax), Money(0), Money(totalTax), Money(internet ? totalTax : 0),
            Clean(h.RdUserId, 20), internet ? "2" : "1");

        var seq = 0;
        foreach (var r in rows)
        {
            Line(sb,
                "D", (++seq).ToString(CultureInfo.InvariantCulture), h.BranchNo, r.NationalId, "0000000000",
                Clean(r.Title, 100), Clean(r.FirstName, 100), Clean(string.IsNullOrWhiteSpace(r.LastName) ? "." : r.LastName, 80),
                $"{r.PaidDate.Day:00}{r.PaidDate.Month:00}{r.PaidDate.Year + 543}",
                "0.00", // เงินเดือนหักแบบอัตราก้าวหน้า ไม่มีอัตราคงที่
                Money(r.PaidAmount), Money(r.Tax),
                "1", // 40(1) เงินเดือน ค่าจ้าง
                "1", // หัก ณ ที่จ่าย
                "", "", "", "", Clean(r.AddressLine, 40), "", "", "",
                Clean(r.Subdistrict, 50), Clean(r.District, 50), Clean(r.Province, 50), r.PostalCode);
        }
        return sb.ToString();
    }

    private static void Line(StringBuilder sb, params string[] fields) => sb.Append(string.Join('|', fields)).Append("\r\n");

    private static string Money(decimal v) =>
        Math.Round(v, 2, MidpointRounding.AwayFromZero).ToString("0.00", CultureInfo.InvariantCulture);

    /// <summary>ตัดอักขระที่กรมสรรพากรห้าม (/ ในบ้านเลขที่ → -) และตัดให้ไม่เกินความยาวที่กำหนด</summary>
    public static string Clean(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        var sb = new StringBuilder(value.Length);
        foreach (var c in value.Trim())
        {
            if (c == '/' || c == '\\') sb.Append('-');
            else if ("*+!$%#&@,'\"|“”‘’\r\n".Contains(c)) sb.Append(' ');
            else sb.Append(c);
        }
        var clean = string.Join(' ', sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
        return clean.Length > max ? clean[..max].TrimEnd() : clean;
    }
}
