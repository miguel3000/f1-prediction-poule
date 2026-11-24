import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type StreamTransport from 'nodemailer/lib/stream-transport';
import { htmlToText } from './htmlToText';

// Every mail we send goes through the transporter made here, so what spam filters look for is done
// once, for all of them, instead of in each of the twenty-odd send functions:
//  - a plain-text part next to the HTML (an HTML-only mail scores worse, and some readers only
//    show the text part). A text part written by hand is kept.
// The headers for mail with an unsubscribe link are added by unsubscribeOptions below.

const addPlainText: Mail.PluginFunction = (mail, done) => {
  try {
    const { html, text } = mail.data;
    if (typeof html === 'string' && html && !text) mail.data.text = htmlToText(html);
    done();
  } catch (error) {
    done(error as Error);
  }
};

// SMTP is what runs in production; the stream transport (the mail as text, nothing sent) is for tests.
export function createMailTransporter(options: SMTPTransport.Options): Mail<SMTPTransport.SentMessageInfo>;
export function createMailTransporter(options: StreamTransport.Options): Mail<StreamTransport.SentMessageInfo>;
export function createMailTransporter(options: SMTPTransport.Options | StreamTransport.Options) {
  const transporter = nodemailer.createTransport(options as SMTPTransport.Options);
  transporter.use('compile', addPlainText);
  return transporter;
}

// RFC 8058 one-click unsubscribe: mail apps (Gmail, Apple Mail, Outlook) show their own
// "Unsubscribe" button next to the sender when both headers are there, and Gmail and Yahoo expect
// them on anything bulk. The link is the same signed one as in the footer; the endpoint accepts the
// POST the mail app sends (routes/auth.ts). Mail you cannot opt out of gets nothing.
export const unsubscribeOptions = (
  url: string | undefined
): { list?: { unsubscribe: string }; headers?: Record<string, string> } =>
  url ? { list: { unsubscribe: url }, headers: { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {};
