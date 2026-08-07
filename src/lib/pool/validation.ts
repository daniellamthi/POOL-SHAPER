import type { CustomerInfo } from "./types";

export const REQUIRED_CUSTOMER_FIELDS = ["name", "email", "phone", "city", "country"] as const;

export type RequiredCustomerField = (typeof REQUIRED_CUSTOMER_FIELDS)[number];

export const CUSTOMER_FIELD_LABELS: Record<RequiredCustomerField, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  city: "City",
  country: "Country",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function getCustomerValidation(customer: CustomerInfo) {
  const missing = REQUIRED_CUSTOMER_FIELDS.filter((key) => customer[key].trim().length === 0);
  const emailValid = customer.email.trim().length > 0 && EMAIL_PATTERN.test(customer.email.trim());

  return {
    valid: missing.length === 0 && emailValid,
    missing,
    emailValid,
  };
}
