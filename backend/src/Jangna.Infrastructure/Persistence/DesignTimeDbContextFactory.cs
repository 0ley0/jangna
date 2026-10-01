using Jangna.Core.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Jangna.Infrastructure.Persistence;

/// <summary>ใช้กับ `dotnet ef` — connection string จาก env JANGNA_DIRECT_DB (direct, ไม่ผ่าน pooler)</summary>
public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<JangnaDbContext>
{
    public JangnaDbContext CreateDbContext(string[] args)
    {
        var cs = Environment.GetEnvironmentVariable("JANGNA_DIRECT_DB")
                 ?? "Host=127.0.0.1;Port=5433;Database=jangna;Username=jangna;Password=jangna";

        var options = new DbContextOptionsBuilder<JangnaDbContext>()
            .UseNpgsql(cs)
            .UseSnakeCaseNamingConvention()
            .Options;

        return new JangnaDbContext(options, new FixedTenantContext(null));
    }
}
