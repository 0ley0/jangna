using Jangna.Payroll.Engine.Rules;

namespace Jangna.Payroll.Engine.Calculators;

public static class IncomeTaxCalculator
{
    /// <summary>ภาษีทั้งปีจากเงินได้พึงประเมิน (ม.40(1)) หลังหักค่าใช้จ่าย ค่าลดหย่อนส่วนตัว และอื่นๆ</summary>
    public static decimal AnnualTax(decimal annualIncome, decimal otherAllowances, IncomeTaxRule rule)
    {
        if (annualIncome <= 0) return 0m;

        var expense = Math.Min(annualIncome * rule.ExpenseDeductionRate, rule.ExpenseDeductionCap);
        var netIncome = annualIncome - expense - rule.PersonalAllowance - otherAllowances;
        return ProgressiveTax(netIncome, rule.Brackets);
    }

    public static decimal ProgressiveTax(decimal netIncome, IReadOnlyList<TaxBracket> brackets)
    {
        var tax = 0m;
        var lower = 0m;
        foreach (var bracket in brackets)
        {
            if (netIncome <= lower) break;
            var upper = bracket.UpTo ?? decimal.MaxValue;
            tax += (Math.Min(netIncome, upper) - lower) * bracket.Rate;
            lower = upper;
        }
        return tax;
    }

    /// <summary>
    /// หัก ณ ที่จ่ายแบบสะสม: ประมาณรายได้ทั้งปี = ยอดก่อนหน้า + รอบนี้ × รอบที่เหลือ
    /// แล้วเฉลี่ยภาษีที่ยังขาดลงในรอบที่เหลือ — รายได้ไม่สม่ำเสมอจะถูกปรับเองในรอบถัดไป
    /// </summary>
    public static decimal PeriodWithholding(
        decimal currentTaxableIncome,
        decimal currentSocialSecurity,
        decimal ytdTaxableIncome,
        decimal ytdTaxWithheld,
        decimal ytdSocialSecurity,
        int remainingPeriods,
        decimal additionalAllowances,
        IncomeTaxRule rule)
    {
        if (remainingPeriods < 1) throw new ArgumentOutOfRangeException(nameof(remainingPeriods));

        var projectedIncome = ytdTaxableIncome + currentTaxableIncome * remainingPeriods;
        var projectedSocialSecurity = ytdSocialSecurity + currentSocialSecurity * remainingPeriods;
        var annualTax = AnnualTax(projectedIncome, projectedSocialSecurity + additionalAllowances, rule);

        var perPeriod = (annualTax - ytdTaxWithheld) / remainingPeriods;
        return Math.Max(0m, Math.Round(perPeriod, 2, MidpointRounding.AwayFromZero));
    }
}
