using System.Globalization;
using System.Text;

namespace Jangna.Api.Exports;

/// <summary>
/// ใบแนบ ภ.ง.ด.3 (ผู้รับเงินเป็นบุคคลธรรมดาที่ไม่ใช่เงินเดือน เช่น ฟรีแลนซ์) เป็น CSV UTF-8 มี BOM เปิดใน Excel ได้
/// คอลัมน์ตามใบแนบที่พิมพ์ในแบบ — สมมติฐาน: ยังไม่ใช่ไฟล์รูปแบบทางการของกรมสรรพากร (ดู docs/payroll.md)
/// ใช้กรอกต่อในโปรแกรม RD Prep / ยื่นแบบออนไลน์ ตัวเลข 2 ตำแหน่ง ไม่มีตัวคั่นหลักพัน
/// </summary>
public static class Pnd3File
{
    public sealed record Header(string TaxId, string BranchNo, int Year, int Month);

    public sealed record Row(
        string NationalId, string Title, string FirstName, string LastName, DateOnly PaidDate, decimal PaidAmount, decimal Tax,
        decimal Rate, string? AddressLine, string? Subdistrict, string District, string Province, string PostalCode);

    public static string FileName(Header h) => $"PND3_{h.TaxId}_{h.BranchNo}_{h.Year + 543}_{h.Month:00}.csv";

    public static string Build(IReadOnlyList<Row> rows)
    {
        var sb = new StringBuilder("﻿");
        Line(sb, "ลำดับ", "เลขประจำตัวประชาชน", "คำนำหน้า", "ชื่อ", "สกุล", "ที่อยู่", "วันที่จ่าย (พ.ศ.)", "ประเภทเงินได้",
            "อัตราภาษี (%)", "จำนวนเงินที่จ่าย", "ภาษีที่หักและนำส่ง", "เงื่อนไขการหัก");
        var seq = 0;
        foreach (var r in rows)
        {
            var address = string.Join(' ', new[] { r.AddressLine, r.Subdistrict, r.District, r.Province, r.PostalCode }
                .Where(s => !string.IsNullOrWhiteSpace(s)));
            Line(sb, (++seq).ToString(CultureInfo.InvariantCulture), r.NationalId, r.Title, r.FirstName, r.LastName, address,
                $"{r.PaidDate.Day:00}/{r.PaidDate.Month:00}/{r.PaidDate.Year + 543}",
                "ค่าจ้างทำของ/บริการ", (r.Rate * 100).ToString("0.##", CultureInfo.InvariantCulture),
                Money(r.PaidAmount), Money(r.Tax), "1");
        }
        return sb.ToString();
    }

    private static void Line(StringBuilder sb, params string[] fields) =>
        sb.Append(string.Join(',', fields.Select(Quote))).Append("\r\n");

    /// <summary>ครอบด้วย " และกันสูตร Excel (=, +, -, @ นำหน้า) ไม่ให้ถูกรันเมื่อเปิดไฟล์</summary>
    private static string Quote(string value)
    {
        if (value.Length > 0 && "=+-@\t\r".Contains(value[0]) && !decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out _))
            value = "'" + value;
        return $"\"{value.Replace("\"", "\"\"")}\"";
    }

    private static string Money(decimal v) =>
        Math.Round(v, 2, MidpointRounding.AwayFromZero).ToString("0.00", CultureInfo.InvariantCulture);
}
