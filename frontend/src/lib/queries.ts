import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Branch, Employee, Me, Shop } from "./types";

export const keys = {
  me: ["me"] as const,
  branches: ["branches"] as const,
  employees: ["employees"] as const,
  shop: ["shop"] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api<Me>("/api/me") });
export const useBranches = () => useQuery({ queryKey: keys.branches, queryFn: () => api<Branch[]>("/api/branches") });
export const useEmployees = () =>
  useQuery({ queryKey: keys.employees, queryFn: () => api<Employee[]>("/api/employees") });
export const useShop = () => useQuery({ queryKey: keys.shop, queryFn: () => api<Shop>("/api/shop") });
