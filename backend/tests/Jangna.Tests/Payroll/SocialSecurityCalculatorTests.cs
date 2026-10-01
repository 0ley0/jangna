using Jangna.Payroll.Engine.Calculators;
using Jangna.Payroll.Engine.Rules;

namespace Jangna.Tests.Payroll;

public class SocialSecurityCalculatorTests
{
    private static readonly SocialSecurityRule Rule2026 = new(0.05m, 1650m, 17500m);

    [Theory]
    [InlineData(10000, 500)]
    [InlineData(17500, 875)]
    [InlineData(30000, 875)]   // เกินเพดาน → ใช้ฐาน 17,500
    [InlineData(1000, 83)]     // ต่ำกว่าฐานขั้นต่ำ → ใช้ฐาน 1,650 = 82.50 → ปัดขึ้น
    [InlineData(10510, 526)]   // 525.50 → ปัดขึ้น
    [InlineData(10509, 525)]   // 525.45 → ปัดทิ้ง
    [InlineData(0, 0)]
    public void Contribution_clamps_base_and_rounds_to_baht(decimal wage, decimal expected) =>
        Assert.Equal(expected, SocialSecurityCalculator.MonthlyContribution(wage, Rule2026));
}
