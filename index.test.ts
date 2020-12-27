import { LiteralNodesFinder, LiteralPart, parseHtmlLiteral, renderToHtml } from ".";

describe("the parser", () => {
  test("can parse nodes", () => {
    expectHtmlLiteralParts`<span>${0}`.toMatchParts([
      "node",
    ]);

    expectHtmlLiteralParts`<span>${0}</span>`.toMatchParts([
      "node",
    ]);

    expectHtmlLiteralParts`<span>${0} ${1}</span>`.toMatchParts([
      "node",
      "node",
    ]);
  });

  test("can parse data", () => {
    expectHtmlLiteralParts`<span ${0}>`.toMatchParts([
      "data",
    ]);

    expectHtmlLiteralParts`<span ${0}></span>`.toMatchParts([
      "data",
    ]);

    expectHtmlLiteralParts`<span ${0} ${1}></span>`.toMatchParts([
      "data",
      "data",
    ]);
  });

  test("can parse comments", () => {
    expectHtmlLiteralParts`<span><!-- ${0} -->`.toMatchParts([
      "comment",
    ]);
  });

  test("can parse unquoted attributes", () => {
    expectHtmlLiteralParts`<a href=${0}>`.toMatchParts([
      { attr: "href", parts: ["", ""], index: 0 },
    ]);

    expectHtmlLiteralParts`<a href=${0}${1}>`.toMatchParts([
      { attr: "href", parts: ["", "", ""], index: 0 },
      { attr: "href", parts: ["", "", ""], index: 1 },
    ]);

    expectHtmlLiteralParts`<a ?foo=${0} @bar=${1} .baz=${2} :quux=${3}>`.toMatchParts([
      { attr: "?foo", parts: ["", ""], index: 0 },
      { attr: "@bar", parts: ["", ""], index: 0 },
      { attr: ".baz", parts: ["", ""], index: 0 },
      { attr: ":quux", parts: ["", ""], index: 0 },
    ]);
  });

  test("can parse double-quoted attributes", () => {
    expectHtmlLiteralParts`<a href="/${0}">`.toMatchParts([
      { attr: "href", parts: ["/", ""], index: 0 },
    ]);

    expectHtmlLiteralParts`<a href="/${0}/">`.toMatchParts([
      { attr: "href", parts: ["/", "/"], index: 0 },
    ]);

    expectHtmlLiteralParts`<a href="/${0}/${1}">`.toMatchParts([
      { attr: "href", parts: ["/", "/", ""], index: 0 },
      { attr: "href", parts: ["/", "/", ""], index: 1 },
    ]);

    expectHtmlLiteralParts`<a href="/${0}/${1}${2}">`.toMatchParts([
      { attr: "href", parts: ["/", "/", "", ""], index: 0 },
      { attr: "href", parts: ["/", "/", "", ""], index: 1 },
      { attr: "href", parts: ["/", "/", "", ""], index: 2 },
    ]);
  });

  test("can parse single-quoted attributes", () => {
    expectHtmlLiteralParts`<a href='/${0}'>`.toMatchParts([
      { attr: "href", parts: ["/", ""], index: 0 },
    ]);

    expectHtmlLiteralParts`<a href='/${0}/'>`.toMatchParts([
      { attr: "href", parts: ["/", "/"], index: 0 },
    ]);

    expectHtmlLiteralParts`<a href='/${0}/${1}'>`.toMatchParts([
      { attr: "href", parts: ["/", "/", ""], index: 0 },
      { attr: "href", parts: ["/", "/", ""], index: 1 },
    ]);

    expectHtmlLiteralParts`<a href='/${0}/${1}${2}'>`.toMatchParts([
      { attr: "href", parts: ["/", "/", "", ""], index: 0 },
      { attr: "href", parts: ["/", "/", "", ""], index: 1 },
      { attr: "href", parts: ["/", "/", "", ""], index: 2 },
    ]);
  });

  test("can parse arbitrary nodes", () => {
    expectHtmlLiteralParts`<a style="${0}: ${1}" href=${1} ${2}>${3}</a>${4}`.toMatchParts([
      { attr: "style", parts: ["", ": ", ""], index: 0 },
      { attr: "style", parts: ["", ": ", ""], index: 1 },
      { attr: "href", parts: ["", ""], index: 0 },
      "data",
      "node",
      "node",
    ]);
  });

  test("can parse example", () => {
    // @ts-ignore
    const parts = parseHtmlLiteral`<a style="${0}:${1}" href=${2} ${3}>${4}</a>`;

    expect(parts.length).toBe(5);

    const [part0, part1, part2, part3, part4] = parts as LiteralPart.Attribute[];

    expect(part0.type).toBe(LiteralPart.Kind.Attribute);
    expect(part1.type).toBe(LiteralPart.Kind.Attribute);
    expect(part2.type).toBe(LiteralPart.Kind.Attribute);
    expect(part3.type).toBe(LiteralPart.Kind.Data);
    expect(part4.type).toBe(LiteralPart.Kind.Node);

    expect(part0.attributeName).toBe("style");
    expect(part1.attributeName).toBe("style");
    expect(part2.attributeName).toBe("href");

    expect(part0.valueParts).toEqual(["", ":", ""]);
    expect(part1.valueParts).toBe(part0.valueParts);  // reference equality
    expect(part2.valueParts).toEqual(["", ""]);

    expect(part0.index).toBe(0);
    expect(part1.index).toBe(1);
    expect(part2.index).toBe(0);
  });
});

describe("the html renderer", () => {
  test("can render html", () => {
    expectHtmlString`<a style="${0}: ${1}" href=${1} ${2}>${3}</a>${4}`.toBe(
      `<a style="::: ::" href=:: ::3=0><!--::4--></a><!--::5-->`,
    );
  });
});

describe("LiteralNodesFinder", () => {
  test("can find a simple attribute", () => {
    const [root, nodes, expectSecondComputationToMatch] = findNodes`<a href=${0}>`;

    expect(nodes[0]).toBe(root.children[0].attributes.getNamedItem("href"));
    expectSecondComputationToMatch();
  });

  test("can find attributes", () => {
    const [root, nodes, expectSecondComputationToMatch] = findNodes`
      <span id='i-${0}-${1}'><input><a href=${2}>`;

    expect(nodes[0]).toBe(root.children[0].attributes.getNamedItem("id"));
    expect(nodes[1]).toBe(root.children[0].attributes.getNamedItem("id"));
    expect(nodes[2]).toBe(root.children[0].children[1].attributes.getNamedItem("href"));
    expectSecondComputationToMatch();
  });

  test("can find a simple data part", () => {
    const [root, nodes, expectSecondComputationToMatch] = findNodes`<div ${0}>`;

    expect((nodes[0] as Attr).ownerElement).toBe(root.children[0]);
    expectSecondComputationToMatch();
  });

  test("can find data parts", () => {
    const [root, nodes, expectSecondComputationToMatch] = findNodes`<div ${0} ${1}><b ${2}>`;

    expect((nodes[0] as Attr).ownerElement).toBe(root.children[0]);
    expect((nodes[1] as Attr).ownerElement).toBe(root.children[0]);
    expect((nodes[2] as Attr).ownerElement).toBe(root.children[0].children[0]);
    expectSecondComputationToMatch();
  });

  test("can find a simple node", () => {
    const [root, nodes, expectSecondComputationToMatch] = findNodes`<span>${0}`;

    expect(nodes[0]).toBe(root.children[0].childNodes[0]);
    expectSecondComputationToMatch();
  });

  test("can find nodes", () => {
    const [root, nodes, expectSecondComputationToMatch] = findNodes`<span>${0}hello${1}</span>${2}`;

    expect(nodes[0]).toBe(root.children[0].childNodes[0]);
    expect(nodes[1]).toBe(root.children[0].childNodes[2]);
    expect(nodes[2]).toBe(root.childNodes[1]);
    expectSecondComputationToMatch();
  });

  test("can find a simple comment", () => {
    const [root, nodes, expectSecondComputationToMatch] = findNodes`<span><!-- ${0} -->`;

    expect(nodes[0]).toBe(root.children[0].childNodes[0]);
    expectSecondComputationToMatch();
  });

  test("can find comments", () => {
    const [root, nodes, expectSecondComputationToMatch] = findNodes`
      <span>xx<!-- ${0} --><!-- ${1} -->`;

    expect(nodes[0]).toBe(root.children[0].childNodes[1]);
    expect(nodes[1]).toBe(root.children[0].childNodes[2]);
    expectSecondComputationToMatch();
  });

  test("can find mixed nodes", () => {
    const [root, nodes, expectSecondComputationToMatch] = findNodes`
      <div ${0}><span id=${1}>xxx<b class="${2} ${3}" ${4}>${5}${6}<i></i>${7}</b><!-- xx${8} -->`;
    const div = root.children[0];

    expect((nodes[0] as Attr).ownerElement).toBe(div);
    expect(nodes[1]).toBe(div.children[0].attributes.getNamedItem("id"));
    expect(nodes[2]).toBe(div.children[0].children[0].attributes.getNamedItem("class"));
    expect(nodes[3]).toBe(div.children[0].children[0].attributes.getNamedItem("class"));
    expect((nodes[4] as Attr).ownerElement).toBe(div.children[0].children[0]);
    expect(nodes[5]).toBe(div.children[0].children[0].childNodes[0]);
    expect(nodes[6]).toBe(div.children[0].children[0].childNodes[1]);
    expect(nodes[7]).toBe(div.children[0].children[0].childNodes[3]);
    expect(nodes[8]).toBe(div.children[0].childNodes[2]);
    expectSecondComputationToMatch();
  });
});

type PartMatcher =
  | "node" | "data" | "comment"
  | { attr: string, parts: readonly string[], index: number };

declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchParts(parts: readonly PartMatcher[]): R;
    }
  }
}

expect.extend({
  toMatchParts(received: readonly LiteralPart[], matchers: readonly PartMatcher[]) {
    if (received.length !== matchers.length) {
      return {
        pass: false,
        message: () => `expected literal input to have ${matchers.length} parts instead of ` +
                       `${received.length}`,
      };
    }

    for (let i = 0; i < received.length; i++) {
      const actual = received[i],
            expected = matchers[i];

      const actualType = actual.type === LiteralPart.Kind.Comment ? "comment"
                       : actual.type === LiteralPart.Kind.Data ? "data"
                       : actual.type === LiteralPart.Kind.Node ? "node"
                       : "attribute";

      if (typeof expected === "string") {
        if (actualType !== expected) {
          return {
            pass: false,
            message: () => `expected part #${i} to have type ${expected} instead of ${actualType}`,
          };
        }
      } else {
        if (actual.type !== LiteralPart.Kind.Attribute) {
          return {
            pass: false,
            message: () => `expected part #${i} to be an attribute instead of a ${actualType}`,
          };
        }
        if (actual.attributeName !== expected.attr) {
          return {
            pass: false,
            message: () => `expected part #${i} to have attribute name '${expected.attr}' ` +
                           `instead of '${actual.attributeName}'`,
          };
        }
        if (!this.equals(actual.valueParts, expected.parts)) {
          return {
            pass: false,
            message: () => `expected part #${i} to have attribute parts ` +
                           `${JSON.stringify(expected.parts)} instead of ` +
                           `${JSON.stringify(actual.valueParts)}`,
          };
        }
        if (actual.index !== expected.index) {
          return {
            pass: false,
            message: () => `expected part #${i} to have attribute value at index ` +
                           `${expected.index} instead of ${actual.index}`,
          };
        }
      }
    }

    return {
      pass: true,
      message: () => `expected ${JSON.stringify(received)} not to match the given matchers`,
    };
  },
});

function expectHtmlLiteralParts(strings: TemplateStringsArray, ..._: any[]) {
  return expect(parseHtmlLiteral(strings));
}

function expectHtmlString(strings: TemplateStringsArray, ..._: any[]) {
  return expect(renderToHtml(strings, parseHtmlLiteral(strings)));
}

/**
 * Returns a triple:
 * - `root`, the `DocumentFragment` corresponding to the rendered root of the
 *   HTML template literal.
 * - `nodes`, the result of calling `LiteralNodesFinder.find(root)`.
 * - `expectSecondComputationToMatch`, a function that will ensure that the
 *   second call to `LiteralNodesFinder.find(root)` returns the same thing as
 *   the first call, which is important since internally the processing is done
 *   differently.
 */
function findNodes(strings: TemplateStringsArray, ..._: any[]) {
  const parts = parseHtmlLiteral(strings),
        htmlString = renderToHtml(strings, parts),
        root = document.createRange().createContextualFragment(htmlString),
        finder = new LiteralNodesFinder(parts),
        nodes = finder.find(root);

  return [root, nodes, () => expect(finder.find(root)).toEqual(nodes)] as const;
}
