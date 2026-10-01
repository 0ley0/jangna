using Jangna.Infrastructure.Seed;

namespace Jangna.Tests.Payroll;

public class MinimumWageSeedTests
{
    private static readonly string SeedPath =
        Path.Combine(AppContext.BaseDirectory, "Seed", "minimum-wages.draft.json");

    [Fact]
    public void Draft_seed_covers_all_77_provinces_exactly_once()
    {
        var rates = LegalDataSeeder.LoadMinimumWages(File.ReadAllText(SeedPath)).ToList();
        var provinceWide = rates.Where(r => r.AreaCode is null).ToList();

        Assert.Equal(77, provinceWide.Count);
        Assert.Equal(77, provinceWide.Select(r => r.ProvinceCode).Distinct().Count());
        Assert.All(rates, r => Assert.Matches(@"^TH-\d{2}$", r.ProvinceCode));
    }

    [Fact]
    public void Draft_seed_is_marked_unverified()
    {
        var rates = LegalDataSeeder.LoadMinimumWages(File.ReadAllText(SeedPath));
        Assert.All(rates, r => Assert.False(r.Verified));
    }

    [Fact]
    public void Area_overrides_belong_to_seeded_provinces()
    {
        var rates = LegalDataSeeder.LoadMinimumWages(File.ReadAllText(SeedPath)).ToList();
        var provinces = rates.Where(r => r.AreaCode is null).Select(r => r.ProvinceCode).ToHashSet();

        Assert.All(rates.Where(r => r.AreaCode is not null), r => Assert.Contains(r.ProvinceCode, provinces));
    }
}
