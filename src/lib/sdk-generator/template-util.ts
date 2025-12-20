import Handlebars from 'handlebars';

export function renderTemplate(template: string, context: Record<string, any>): string {
  const compiled = Handlebars.compile(template);
  return compiled(context);
}
