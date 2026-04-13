/**
 * Legacy import path wrapper.
 * Redirects to the new provider-agnostic email service layer.
 */
import { emailService } from "./email";

export const mailService = emailService;
