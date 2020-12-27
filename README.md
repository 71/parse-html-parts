# `parse-html-parts`

This project provides utilities for parsing HTML-like JavaScript
[template literals](
https://developer.mozilla.org/docs/Web/JavaScript/Reference/Template_literals),
similarly to [htl](https://github.com/observablehq/htl)
and [lit-html](https://github.com/Polymer/lit-html).

Unlike those libraries, though, the result is not directly usable in the DOM.
Instead, `LiteralPart`s are returned, which can be inspected to then create
your own renderers.

## Example
First, we parse the template literal into `LiteralPart`s. Each resulting
`LiteralPart` corresponds to a passed expression.

```ts
const parts = parseHtmlLiteral`<p style="${0}: ${1}" ${2}>hey ${3}</p>`;
```

<details>
<summary>Tests</summary>
<p>

```ts
expect(parts.length).toBe(4);

const [part0, part1, part2, part3] = parts;

expect(part0.type).toBe(LiteralPart.Kind.Attribute);
expect(part1.type).toBe(LiteralPart.Kind.Attribute);
expect(part2.type).toBe(LiteralPart.Kind.Data);
expect(part3.type).toBe(LiteralPart.Kind.Node);

expect(part0.attributeName).toBe("style");
expect(part0.valueParts).toEqual(["", ":", ""]);
expect(part0.index).toBe(0);

expect(part1.attributeName).toBe("style");
expect(part1.valueParts).toBe(part0.valueParts);
expect(part1.index).toBe(1);
```

</p>
</details>

Then, we can render the parts into a valid HTML string.

```ts
const strings = (strings => strings)`<p style="${0}: ${1}" ${2}>hey ${3}</p>`,
      htmlString = renderToHtml(strings, parts),
      root = document.createRange().createContextualFragment(htmlString);
```

And once it's rendered, we can find its marked nodes:

```ts
const finder = new LiteralNodesFinder(parts),
      nodes = finder.find(root);
```

<details>
<summary>Tests</summary>
<p>

```ts
const p = root.children[0];

expect(nodes.length).toBe(4);

expect(nodes[0].ownerElement).toBe(p);
expect(nodes[1].ownerElement).toBe(p);
expect(nodes[2].ownerElement).toBe(p);
expect(nodes[3]).toBe(p.childNodes[1]);
```

</p>
</details>

Please see the [html.test.ts](html.test.ts) file for an example `html` function
that renders directly to a `DocumentFragment`.
