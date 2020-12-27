import { LiteralNodesFinder, LiteralPart, parseHtmlLiteral, renderToHtml } from ".";

class Template {
  public constructor(
    public readonly fragment: DocumentFragment,
    public readonly parts: readonly LiteralPart[],
    public readonly finder: LiteralNodesFinder,
  ) {}
}

const templates = new WeakMap<TemplateStringsArray, Template>();

/**
 * Example showing how to render concrete nodes.
 */
function html(strings: TemplateStringsArray, ...args: (string | Node | object)[]) {
  let template = templates.get(strings);

  if (template === undefined) {
    const parts = parseHtmlLiteral(strings),
          finder = new LiteralNodesFinder(parts),
          htmlString = renderToHtml(strings, parts),
          fragment = document.createRange().createContextualFragment(htmlString);

    templates.set(strings, template = new Template(fragment, parts, finder));
  }

  const root = template.fragment.cloneNode(true) as DocumentFragment,
        nodes = template.finder.find(root),
        parts = template.parts;

  for (let i = 0, len = args.length; i < len; i++) {
    const arg = args[i],
          part = parts[i],
          node = nodes[i];

    switch (part.type) {
      case LiteralPart.Kind.Attribute:
        if (part.index === 0) {
          (node as Attr).value = String.raw(part.valueParts, ...args.slice(i, i + part.valueParts.length - 1));
        }
        break;

      case LiteralPart.Kind.Data:
        Object.assign((node as Attr).ownerElement!, arg);
        (node as Attr).ownerElement!.removeAttributeNode(node as Attr);
        break;

      case LiteralPart.Kind.Node:
        (node as Comment).replaceWith(arg as string | Node);
        break;

      case LiteralPart.Kind.Comment:
        // Ignore comments.
        break;
    }
  }

  return root;
}

function expectHtml(strings: TemplateStringsArray, ...args: (string | Node | object)[]) {
  let allHtml = "";

  for (const child of html(strings, ...args).childNodes as unknown as Node[]) {
    allHtml += (child as Element).outerHTML ?? child.textContent;
  }

  return expect(allHtml);
}

test("can render a simple node", () => {
  expectHtml`<span>Hello`.toBe(`<span>Hello</span>`);
});

test("can render nodes", () => {
  expectHtml`<span class="${"foo"} ${"bar"}"><a ${{ href: "#" }}>${html`<i>Hi`}`.toBe(
    `<span class="foo bar"><a href="#"><i>Hi</i></a></span>`,
  );
});
