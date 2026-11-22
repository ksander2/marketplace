import nodemailer, { type Transporter } from "nodemailer";
import type { Email, Mailer } from "../domain/notification-service.js";

interface SmtpMailerOptions {
  host: string;
  port: number;
  from: string;
}

export class SmtpMailer implements Mailer {
  private readonly transporter: Transporter;

  constructor(private readonly options: SmtpMailerOptions) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: false,
    });
  }

  async send(email: Email): Promise<void> {
    await this.transporter.sendMail({ from: this.options.from, ...email });
  }

  close(): void {
    this.transporter.close();
  }
}
