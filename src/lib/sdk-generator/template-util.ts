// @ts-ignore - handlebars module
import Handlebars from 'handlebars';

export function renderTemplate(template: string, context: Record<string, unknown>): string {
  const compiled = Handlebars.compile(template);
  return compiled(context);
}
