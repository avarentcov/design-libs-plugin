/**
 * JSON-схема инструмента report_issues — Claude должен его вызвать.
 * Гарантирует структурированный JSON без хрупкого парсинга.
 */

export const REPORT_ISSUES_TOOL = {
  name: 'report_issues',
  description:
    'Сообщить о найденных на макете нарушениях правил дизайна. Вызвать ровно один раз, собрав все найденные проблемы в массив issues. Если нарушений нет — вернуть пустой массив.',
  input_schema: {
    type: 'object',
    properties: {
      issues: {
        type: 'array',
        description: 'Список найденных проблем (может быть пустым).',
        items: {
          type: 'object',
          properties: {
            ruleId: { type: 'string', description: 'id правила из переданного каталога.' },
            severity: { type: 'string', enum: ['error', 'warning', 'info'] },
            title: { type: 'string', description: 'Короткий заголовок 3–6 слов.' },
            summary: { type: 'string', description: 'Одно предложение: что не так.' },
            nodeHint: { type: 'string', description: 'Подсказка о расположении элемента на макете.' },
            fix: {
              type: 'object',
              description: 'Как исправить — конкретно и коротко.',
              properties: {
                steps: {
                  type: 'array',
                  description: '1–3 шага исправления.',
                  items: { type: 'string' },
                },
                expected: { type: 'string', description: 'Опциональное целевое состояние.' },
              },
              required: ['steps'],
            },
          },
          required: ['ruleId', 'severity', 'title', 'summary', 'fix'],
        },
      },
      summary: { type: 'string', description: 'Одно-два предложения с общим впечатлением о макете.' },
    },
    required: ['issues'],
  },
} as const
