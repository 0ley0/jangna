using Jangna.Core.Entities;
using Jangna.Core.Tenancy;
using Jangna.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Tests.Infrastructure;

public class TenantIsolationTests
{
    private readonly string _dbName = Guid.NewGuid().ToString();
    private readonly Guid _shopA = Guid.NewGuid();
    private readonly Guid _shopB = Guid.NewGuid();

    private JangnaDbContext Context(Guid? tenantId) =>
        new(new DbContextOptionsBuilder<JangnaDbContext>().UseInMemoryDatabase(_dbName).Options,
            new FixedTenantContext(tenantId));

    private async Task SeedTwoShops()
    {
        await using (var a = Context(_shopA))
        {
            a.Employees.Add(new Employee { FirstName = "A1" });
            a.Employees.Add(new Employee { FirstName = "A2" });
            await a.SaveChangesAsync();
        }

        await using var b = Context(_shopB);
        b.Employees.Add(new Employee { FirstName = "B1" });
        await b.SaveChangesAsync();
    }

    [Fact]
    public async Task Each_tenant_sees_only_its_own_rows()
    {
        await SeedTwoShops();

        await using var a = Context(_shopA);
        Assert.Equal(["A1", "A2"], await a.Employees.OrderBy(e => e.FirstName).Select(e => e.FirstName).ToListAsync());

        await using var b = Context(_shopB);
        Assert.Equal(["B1"], await b.Employees.Select(e => e.FirstName).ToListAsync());
    }

    [Fact]
    public async Task No_tenant_sees_nothing()
    {
        await SeedTwoShops();

        await using var anonymous = Context(null);
        Assert.Empty(await anonymous.Employees.ToListAsync());
        Assert.Equal(3, await anonymous.Employees.IgnoreQueryFilters().CountAsync());
    }

    [Fact]
    public async Task New_rows_get_current_tenant_stamped()
    {
        await using var a = Context(_shopA);
        var employee = new Employee { FirstName = "A1" };
        a.Employees.Add(employee);
        await a.SaveChangesAsync();

        Assert.Equal(_shopA, employee.TenantId);
    }

    [Fact]
    public async Task Writing_into_another_tenant_throws()
    {
        await using var a = Context(_shopA);
        a.Employees.Add(new Employee { FirstName = "sneaky", TenantId = _shopB });

        await Assert.ThrowsAsync<InvalidOperationException>(() => a.SaveChangesAsync());
    }

    [Fact]
    public async Task Saving_tenant_data_without_tenant_throws()
    {
        await using var anonymous = Context(null);
        anonymous.Employees.Add(new Employee { FirstName = "orphan" });

        await Assert.ThrowsAsync<InvalidOperationException>(() => anonymous.SaveChangesAsync());
    }
}
