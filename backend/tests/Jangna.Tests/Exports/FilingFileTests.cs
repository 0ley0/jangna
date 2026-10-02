using Jangna.Api.Endpoints;
using Jangna.Api.Exports;
using Jangna.Core.Entities;

namespace Jangna.Tests.Exports;

public class FilingFileTests
{
    [Fact]
    public void Sso_file_is_fixed_width_with_header_and_details()
    {
        // ค่าที่คิดมือ: A เงินเดือน 15,000 → สมทบ 750, B คนแพ็คฐานขั้นต่ำ 1,650 → 82.50 ปัด 83
        var header = new SsoFile.Header("1234567890", "000000", new DateOnly(2026, 11, 15), 2026, 10, "ร้านทดสอบ", 0.05m);
        var rows = new List<SsoFile.Row>
        {
            new("1101700203450", "003", "สมชาย", "ใจดี", 15_000m, 750m),
            new("3100500123458", "004", "สมหญิง", "รักงาน", 1_650m, 83m),
        };

        var content = SsoFile.Build(header, rows, employerContribution: 833m);
        var lines = content.Split("\r\n", StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal(3, lines.Length);
        Assert.All(lines, l => Assert.Equal(135, l.Length));

        // 1 | บัญชี | สาขา | 15/11/69 | 10/69 | ชื่อ 45 | 5.00% | 2 คน | ค่าจ้าง 16,650.00 | สมทบรวม 1,666.00 | ลูกจ้าง 833.00 | นายจ้าง 833.00
        Assert.Equal(
            "1" + "1234567890" + "000000" + "151169" + "1069" + "ร้านทดสอบ".PadRight(45) + "0500" + "000002"
            + "000000001665000" + "00000000166600" + "000000083300" + "000000083300",
            lines[0]);
        Assert.Equal(
            "2" + "1101700203450" + "003" + "สมชาย".PadRight(30) + "ใจดี".PadRight(35) + "00000001500000" + "000000075000" + new string(' ', 27),
            lines[1]);
        Assert.EndsWith("00000000165000" + "000000008300" + new string(' ', 27), lines[2]);

        // TIS-620: ตัวอักษรไทย 1 byte → 135 byte + CRLF ต่อแถว
        Assert.Equal(3 * 137, SsoFile.Encode(content).Length);
    }

    [Fact]
    public void Sso_title_codes_follow_sso()
    {
        Assert.Equal("003", SsoFile.TitleCode(Title.Mr));
        Assert.Equal("004", SsoFile.TitleCode(Title.Miss));
        Assert.Equal("005", SsoFile.TitleCode(Title.Mrs));
    }

    [Fact]
    public void Sso_file_rejects_wrong_account_length()
    {
        var header = new SsoFile.Header("12345", "000000", new DateOnly(2026, 11, 15), 2026, 10, "ร้าน", 0.05m);
        Assert.Throws<ArgumentException>(() => SsoFile.Build(header, [], 0));
    }

    [Fact]
    public void Pnd1_file_follows_rd_format_v2()
    {
        var header = new Pnd1File.Header("1234567890121", "000000", 2026, 10, null);
        var rows = new List<Pnd1File.Row>
        {
            new("1101700203450", "นาย", "สมชาย", "ใจดี", new DateOnly(2026, 10, 31), 50_000m, 6_816.67m,
                "12/3 หมู่ 4", "พญาไท", "ราชเทวี", "กรุงเทพมหานคร", "10400"),
        };

        var lines = Pnd1File.Build(header, rows).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal(
            "H|0000|1234567890121|000000|1|PND1|1234567890121|000000|สำนักงานใหญ่|0|10|2569||00|1|50000.00|6816.67|0.00|6816.67|0.00||1",
            lines[0]);
        Assert.Equal(
            "D|1|000000|1101700203450|0000000000|นาย|สมชาย|ใจดี|31102569|0.00|50000.00|6816.67|1|1|||||12-3 หมู่ 4||||พญาไท|ราชเทวี|กรุงเทพมหานคร|10400",
            lines[1]);
        Assert.Equal(22, lines[0].Split('|').Length);
        Assert.Equal(26, lines[1].Split('|').Length);
        Assert.Equal("PND1_1234567890121_000000_2569_10_00_00.txt", Pnd1File.FileName(header));
    }

    [Fact]
    public void Pnd1_internet_filing_carries_user_id_and_payment()
    {
        var header = new Pnd1File.Header("1234567890121", "000000", 2026, 10, "myrduser");
        var row = new Pnd1File.Row("1101700203450", "-", "A", "", new DateOnly(2026, 10, 31), 100m, 10m, null, null, "เมือง", "ชลบุรี", "20000");

        var head = Pnd1File.Build(header, [row]).Split("\r\n")[0];

        Assert.EndsWith("|10.00|0.00|10.00|10.00|myrduser|2", head);
        Assert.Contains("|-|A|.|", Pnd1File.Build(header, [row])); // ไม่มีนามสกุล → "."
    }

    [Theory]
    [InlineData("บ้าน \"สุข\" 1/2, ซอย 3", "บ้าน สุข 1-2 ซอย 3")]
    [InlineData("A&B @ #5", "A B 5")]
    public void Pnd1_clean_strips_forbidden_characters(string input, string expected) =>
        Assert.Equal(expected, Pnd1File.Clean(input, 100));

    [Theory]
    [InlineData("1234567890121", true)]
    [InlineData("1101700203450", true)]
    [InlineData("1101700203451", false)]
    [InlineData("123456789012", false)]
    public void National_id_checksum(string id, bool valid) =>
        Assert.Equal(valid, EmployeeEndpoints.IsValidNationalId(id));

    [Fact]
    public void Thai_is_one_byte_per_character_in_tis620() =>
        Assert.Equal([0xCA, 0xC1], SsoFile.Encode("สม"));
}
