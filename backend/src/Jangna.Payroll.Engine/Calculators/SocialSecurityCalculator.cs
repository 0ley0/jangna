using Jangna.Payroll.Engine.Rules;

namespace Jangna.Payroll.Engine.Calculators;

public static class SocialSecurityCalculator
{
    /// <summary>
    /// เงินสมทบประกันสังคม (ฝั่งลูกจ้าง = ฝั่งนายจ้าง) จากค่าจ้างรวมของเดือน
    /// ฐานถูกบีบให้อยู่ระหว่าง Min/Max แล้วปัดเศษเป็นบาท: ตั้งแต่ 50 สตางค์ปัดขึ้น ต่ำกว่าปัดทิ้ง
    /// </summary>
    public static decimal MonthlyContribution(decimal monthlyWage, SocialSecurityRule rule)
    {
        if (monthlyWage <= 0) return 0m;

        var wageBase = Math.Clamp(monthlyWage, rule.MinMonthlyBase, rule.MaxMonthlyBase);
        return Math.Round(wageBase * rule.Rate, 0, MidpointRounding.AwayFromZero);
    }
}
