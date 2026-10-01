using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jangna.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOpeningBalances : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "opening_balances",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    employee_id = table.Column<Guid>(type: "uuid", nullable: false),
                    year = table.Column<int>(type: "integer", nullable: false),
                    taxable_income = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    tax_withheld = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    social_security = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    note = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_opening_balances", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_opening_balances_tenant_id_employee_id_year",
                table: "opening_balances",
                columns: new[] { "tenant_id", "employee_id", "year" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "opening_balances");
        }
    }
}
