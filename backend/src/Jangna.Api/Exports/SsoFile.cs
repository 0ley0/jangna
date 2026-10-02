using System.Globalization;
using System.Text;

namespace Jangna.Api.Exports;

/// <summary>
/// ไฟล์ข้อความ สปส.1-10 สำหรับอัปโหลดใน e-Service ของสำนักงานประกันสังคม
/// แถวละ 135 ตัวอักษร: แถวแรก Header (ประเภท 1) ตามด้วย Detail (ประเภท 2) คนละแถว
///
/// Header: 1 | บัญชีนายจ้าง 10 | สาขา 6 | วันที่ชำระ ddMMyy | งวด MMyy | ชื่อสถานประกอบการ 45 | อัตรา 4
///         | จำนวนผู้ประกันตน 6 | ค่าจ้างรวม 15 | เงินสมทบรวม 14 | ส่วนผู้ประกันตน 12 | ส่วนนายจ้าง 12
/// Detail: 2 | เลขประกันสังคม 13 | คำนำหน้า 3 | ชื่อ 30 | นามสกุล 35 | ค่าจ้าง 14 | เงินสมทบ 12 | ว่าง 27
///
/// สมมติฐาน (ต้องทดสอบอัปโหลดจริง — ดู docs/payroll.md): ตัวเลขเป็นสตางค์ไม่มีจุด ชิดขวาเติม 0,
/// ข้อความชิดซ้ายเติมช่องว่าง, ปีเป็น พ.ศ. 2 หลัก, อัตรา 5% = "0500", ไฟล์ TIS-620 (windows-874) ขึ้นบรรทัดด้วย CRLF
/// </summary>
public static class SsoFile
{
    public const int LineLength = 135;

    public sealed record Header(
        string EmployerAccountNo, string BranchNo, DateOnly PaymentDate, int Year, int Month, string EmployerName, decimal Rate);

    public sealed record Row(string SocialSecurityNo, string TitleCode, string FirstName, string LastName, decimal Wage, decimal Contribution);

    /// <summary>รหัสคำนำหน้าชื่อของ สปส.</summary>
    public static string TitleCode(Core.Entities.Title title) => title switch
    {
        Core.Entities.Title.Mr => "003",
        Core.Entities.Title.Miss => "004",
        Core.Entities.Title.Mrs => "005",
        _ => throw new ArgumentOutOfRangeException(nameof(title)),
    };

    public static string Build(Header header, IReadOnlyList<Row> rows, decimal employerContribution)
    {
        var sb = new StringBuilder();
        var head = string.Concat(
            "1",
            Digits(header.EmployerAccountNo, 10),
            Digits(header.BranchNo, 6),
            BuddhistDate(header.PaymentDate),
            $"{header.Month:00}{(header.Year + 543) % 100:00}",
            Text(header.EmployerName, 45),
            Number(header.Rate * 10_000, 4), // 0.05 = 5.00% → ทศนิยม 2 ตำแหน่งไม่มีจุด → "0500"
            Number(rows.Count, 6),
            Satang(rows.Sum(r => r.Wage), 15),
            Satang(rows.Sum(r => r.Contribution) + employerContribution, 14),
            Satang(rows.Sum(r => r.Contribution), 12),
            Satang(employerContribution, 12));
        sb.Append(Check(head)).Append("\r\n");

        foreach (var r in rows)
        {
            var line = string.Concat(
                "2",
                Digits(r.SocialSecurityNo, 13),
                Digits(r.TitleCode, 3),
                Text(r.FirstName, 30),
                Text(r.LastName, 35),
                Satang(r.Wage, 14),
                Satang(r.Contribution, 12),
                new string(' ', 27));
            sb.Append(Check(line)).Append("\r\n");
        }
        return sb.ToString();
    }

    /// <summary>TIS-620 / windows-874 — 1 ตัวอักษรไทย = 1 byte ความยาวต่อแถวจึงเท่ากับจำนวนตัวอักษร</summary>
    public static byte[] Encode(string content)
    {
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        return Encoding.GetEncoding(874).GetBytes(content);
    }

    private static string Check(string line) =>
        line.Length == LineLength ? line : throw new InvalidOperationException($"สปส.1-10 แถวยาว {line.Length} ต้องเป็น {LineLength}");

    private static string BuddhistDate(DateOnly d) => $"{d.Day:00}{d.Month:00}{(d.Year + 543) % 100:00}";

    private static string Digits(string value, int length)
    {
        var digits = new string(value.Where(char.IsAsciiDigit).ToArray());
        if (digits.Length != length) throw new ArgumentException($"ต้องเป็นตัวเลข {length} หลัก: {value}");
        return digits;
    }

    private static string Text(string value, int length)
    {
        var clean = value.Trim().Replace('\r', ' ').Replace('\n', ' ');
        return clean.Length > length ? clean[..length] : clean.PadRight(length);
    }

    private static string Number(decimal value, int length) =>
        Math.Round(value, 0, MidpointRounding.AwayFromZero).ToString("0", CultureInfo.InvariantCulture).PadLeft(length, '0');

    private static string Satang(decimal baht, int length) => Number(baht * 100, length);
}
