using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Jangna.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkPolicies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "work_policy_id",
                table: "employees",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "work_policies",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    cycle_weeks = table.Column<int>(type: "integer", nullable: false),
                    anchor_date = table.Column<DateOnly>(type: "date", nullable: false),
                    archived = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_work_policies", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "work_policy_days",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    work_policy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    week_index = table.Column<int>(type: "integer", nullable: false),
                    day_index = table.Column<int>(type: "integer", nullable: false),
                    shift_template_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_work_policy_days", x => x.id);
                    table.ForeignKey(
                        name: "fk_work_policy_days_shift_templates_shift_template_id",
                        column: x => x.shift_template_id,
                        principalTable: "shift_templates",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_work_policy_days_work_policies_work_policy_id",
                        column: x => x.work_policy_id,
                        principalTable: "work_policies",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_employees_work_policy_id",
                table: "employees",
                column: "work_policy_id");

            migrationBuilder.CreateIndex(
                name: "ix_work_policies_tenant_id_name",
                table: "work_policies",
                columns: new[] { "tenant_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_work_policy_days_shift_template_id",
                table: "work_policy_days",
                column: "shift_template_id");

            migrationBuilder.CreateIndex(
                name: "ix_work_policy_days_tenant_id_work_policy_id_week_index_day_in",
                table: "work_policy_days",
                columns: new[] { "tenant_id", "work_policy_id", "week_index", "day_index" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_work_policy_days_work_policy_id",
                table: "work_policy_days",
                column: "work_policy_id");

            migrationBuilder.AddForeignKey(
                name: "fk_employees_work_policies_work_policy_id",
                table: "employees",
                column: "work_policy_id",
                principalTable: "work_policies",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_employees_work_policies_work_policy_id",
                table: "employees");

            migrationBuilder.DropTable(
                name: "work_policy_days");

            migrationBuilder.DropTable(
                name: "work_policies");

            migrationBuilder.DropIndex(
                name: "ix_employees_work_policy_id",
                table: "employees");

            migrationBuilder.DropColumn(
                name: "work_policy_id",
                table: "employees");
        }
    }
}
