/**
 * A part of a literal parsed by `parseHtmlLiteral`.
 */
export type LiteralPart =
  | LiteralPart.Data
  | LiteralPart.Node
  | LiteralPart.Comment
  | LiteralPart.Attribute;

export namespace LiteralPart {
  /**
   * The kind of a `LiteralPart`.
   */
  export const enum Kind {
    /** Kind of `Node` parts. */
    Node,

    /** Kind of `Data` parts. */
    Data,

    /** Kind of `Comment` parts. */
    Comment,

    /** Kind of `Attribute` parts. */
    Attribute,
  }

  /**
   * A node, for instance:
   *
   * ```html
   * <p>$0</p>
   * ```
   */
  export class Node {
    /** The type of the literal part, ie. `Node`. */
    public readonly type = Kind.Node;

    public constructor() {
      Object.freeze(this);
    }
  }

  export namespace Node {
    /** The unique instance of `Node`. */
    export const instance = new Node();
  }

  /**
   * A piece of data, for instance:
   *
   * ```html
   * <p $0></p>
   * ```
   */
  export class Data {
    /** The type of the literal part, ie. `Data`. */
    public readonly type = Kind.Data;

    public constructor() {
      Object.freeze(this);
    }
  }

  export namespace Data {
    /** The unique instance of `Data`. */
    export const instance = new Data();
  }

  /**
   * A comment, for instance:
   *
   * ```html
   * <!-- $0 -->
   * ```
   */
  export class Comment {
    /** The type of the literal part, ie. `Comment`. */
    public readonly type = Kind.Comment;

    public constructor() {
      Object.freeze(this);
    }
  }

  export namespace Comment {
    /** The unique instance of `Comment`. */
    export const instance = new Comment();
  }

  /**
   * An attribute value, for instance:
   *
   * ```html
   * <a href="/$0/index.html"></a>
   * ```
   */
  export class Attribute {
    /** The type of the literal part, ie. `Attribute`. */
    public readonly type = Kind.Attribute;

    public constructor(
      /** The name of the attribute, e.g. `"href"`. */
      public readonly attributeName: string,
      /** The parts of the attribute, e.g. `["/", "/index.html"]`. */
      public readonly valueParts: TemplateStringsArray,
      /** The index of the part that this literal part represents, e.g. `0`. */
      public readonly index: number,
    ) {
      Object.freeze(this);
    }
  }
}

/**
 * Parses the strings representing a [JavaScript template literal](
 * https://developer.mozilla.org/docs/Web/JavaScript/Reference/Template_literals)
 * into a list of `LiteralPart`s that can be used to preprocess HTML-like
 * template literals.
 *
 * The implementation of the parser is adapted from
 * https://github.com/observablehq/htl, but modified to return `LiteralPart`s
 * instead of directly rendering the strings to HTML.
 *
 * ### Example
 *
 * ```ts
 * const parts = parseHtmlLiteral`<a style="${0}:${1}" href=${2} ${3}>${4}</a>`;
 *
 * expect(parts.length).toBe(5);
 *
 * const [part0, part1, part2, part3, part4] = parts;
 *
 * expect(part0.type).toBe(HtmlLiteralPartKind.Attribute);
 * expect(part1.type).toBe(HtmlLiteralPartKind.Attribute);
 * expect(part2.type).toBe(HtmlLiteralPartKind.Attribute);
 * expect(part3.type).toBe(HtmlLiteralPartKind.Data);
 * expect(part4.type).toBe(HtmlLiteralPartKind.Node);
 *
 * expect(part0.attributeName).toBe("style");
 * expect(part1.attributeName).toBe("style");
 * expect(part2.attributeName).toBe("href");
 *
 * expect([...part0.valueParts]).toEqual(["", ":", ""]);
 * expect(part1.valueParts).toBe(part0.valueParts);  // reference equality
 * expect([...part2.valueParts]).toEqual(["", ""]);
 *
 * expect(part0.index).toBe(0);
 * expect(part1.index).toBe(1);
 * expect(part2.index).toBe(0);
 * ```
 */
export function parseHtmlLiteral(strings: readonly string[]) {
  const parts = new Array<LiteralPart>(strings.length - 1);

  let state = State.DATA,
      nameStart = 0,
      valueStart = 0,
      attributeName = "",
      attributeValueParts = [] as string[] & { raw: string[] };

  attributeValueParts.raw = attributeValueParts;

  function getAttributeLiteralPart(string: string) {
    const index = attributeValueParts.push(string.slice(valueStart)) - 1;

    return new LiteralPart.Attribute(attributeName, attributeValueParts, index);
  }

  function quitAttribute(string: string, position: number) {
    if (attributeValueParts.length > 0) {
      attributeValueParts.push(string.slice(0, position));
      Object.freeze(attributeValueParts);
      attributeValueParts = [] as string[] & { raw: string[] };
      attributeValueParts.raw = attributeValueParts;
    }
  }

  for (let stringi = 0; stringi < strings.length; stringi++) {
    const string = strings[stringi],
          len = string.length;
    valueStart = 0;

    // Process the current string in order to determine how the next value will
    // be inserted.
    for (let pos = 0; pos < len; pos++) {
      const code = string.charCodeAt(pos);

      switch (state) {
        case State.DATA:
          if (code === Code.LT) {
            state = State.TAG_OPEN;
          }
          break;

        case State.TAG_OPEN:
          if (code === Code.BANG) {
            state = State.MARKUP_DECLARATION_OPEN;
          } else if (code === Code.SLASH) {
            state = State.END_TAG_OPEN;
          } else if (isAsciiAlphaCode(code)) {
            state = State.TAG_NAME;
            pos--;
          } else if (code === Code.QUESTION) {
            state = State.BOGUS_COMMENT;
            pos--;
          } else {
            state = State.DATA;
            pos--;
          }
          break;

        case State.END_TAG_OPEN:
          if (isAsciiAlphaCode(code)) {
            state = State.TAG_NAME;
            pos--;
          } else if (code === Code.GT) {
            state = State.DATA;
          } else {
            state = State.BOGUS_COMMENT;
            pos--;
          }
          break;

        case State.TAG_NAME:
          if (isSpaceCode(code)) {
            state = State.BEFORE_ATTRIBUTE_NAME;
          } else if (code === Code.SLASH) {
            state = State.SELF_CLOSING_START_TAG;
          } else if (code === Code.GT) {
            state = State.DATA;
          }
          break;

        case State.BEFORE_ATTRIBUTE_NAME:
          if (isSpaceCode(code)) {
            continue;
          } else if (code === Code.SLASH || code === Code.GT) {
            state = State.AFTER_ATTRIBUTE_NAME;
            pos--;
          } else if (code === Code.EQ) {
            state = State.ATTRIBUTE_NAME;
            nameStart = pos + 1;
          } else {
            state = State.ATTRIBUTE_NAME;
            nameStart = pos;
            pos--;
          }
          break;

        case State.ATTRIBUTE_NAME:
          if (isSpaceCode(code) || code === Code.SLASH || code === Code.GT) {
            state = State.AFTER_ATTRIBUTE_NAME;
            pos--;
          } else if (code === Code.EQ) {
            state = State.BEFORE_ATTRIBUTE_VALUE;
            attributeName = string.slice(nameStart, pos);
            valueStart = pos + 1;
          }
          break;

        case State.AFTER_ATTRIBUTE_NAME:
          if (isSpaceCode(code)) {
            continue;
          } else if (code === Code.SLASH) {
            state = State.SELF_CLOSING_START_TAG;
          } else if (code === Code.EQ) {
            state = State.BEFORE_ATTRIBUTE_VALUE;
            valueStart = pos + 1;
          } else if (code === Code.GT) {
            state = State.DATA;
          } else {
            state = State.ATTRIBUTE_NAME;
            nameStart = pos--;
          }
          break;

        case State.BEFORE_ATTRIBUTE_VALUE:
          if (isSpaceCode(code)) {
            continue;
          } else if (code === Code.DQUOTE) {
            state = State.ATTRIBUTE_VALUE_DOUBLE_QUOTED;
            valueStart = pos + 1;
          } else if (code === Code.SQUOTE) {
            state = State.ATTRIBUTE_VALUE_SINGLE_QUOTED;
            valueStart = pos + 1;
          } else if (code === Code.GT) {
            state = State.DATA;
          } else {
            state = State.ATTRIBUTE_VALUE_UNQUOTED;
            pos--;
          }
          break;

        case State.ATTRIBUTE_VALUE_DOUBLE_QUOTED:
          if (code === Code.DQUOTE) {
            state = State.AFTER_ATTRIBUTE_VALUE_QUOTED;
            quitAttribute(string, pos);
          }
          break;

        case State.ATTRIBUTE_VALUE_SINGLE_QUOTED:
          if (code === Code.SQUOTE) {
            state = State.AFTER_ATTRIBUTE_VALUE_QUOTED;
            quitAttribute(string, pos);
          }
          break;

        case State.ATTRIBUTE_VALUE_UNQUOTED:
          if (isSpaceCode(code)) {
            state = State.BEFORE_ATTRIBUTE_NAME;
            quitAttribute(string, pos);
          } else if (code === Code.GT) {
            state = State.DATA;
            quitAttribute(string, pos);
          }
          break;

        case State.AFTER_ATTRIBUTE_VALUE_QUOTED:
          if (isSpaceCode(code)) {
            state = State.BEFORE_ATTRIBUTE_NAME;
          } else if (code === Code.SLASH) {
            state = State.SELF_CLOSING_START_TAG;
          } else if (code === Code.GT) {
            state = State.DATA;
          } else {
            state = State.BEFORE_ATTRIBUTE_NAME;
            pos--;
          }
          break;

        case State.SELF_CLOSING_START_TAG:
          if (code === Code.GT) {
            state = State.DATA;
          } else {
            state = State.BEFORE_ATTRIBUTE_NAME;
            pos--;
          }
          break;

        case State.BOGUS_COMMENT:
          if (code === Code.GT) {
            state = State.DATA;
          }
          break;

        case State.COMMENT_START:
          if (code === Code.DASH) {
            state = State.COMMENT_START_DASH;
          } else if (code === Code.GT) {
            state = State.DATA;
          } else {
            state = State.COMMENT;
            pos--;
          }
          break;

        case State.COMMENT_START_DASH:
          if (code === Code.DASH) {
            state = State.COMMENT_END;
          } else if (code === Code.GT) {
            state = State.DATA;
          } else {
            state = State.COMMENT;
            pos--;
          }
          break;

        case State.COMMENT:
          if (code === Code.LT) {
            state = State.COMMENT_LESS_THAN_SIGN;
          } else if (code === Code.DASH) {
            state = State.COMMENT_END_DASH;
          }
          break;

        case State.COMMENT_LESS_THAN_SIGN:
          if (code === Code.BANG) {
            state = State.COMMENT_LESS_THAN_SIGN_BANG;
          } else if (code !== Code.LT) {
            state = State.COMMENT;
            pos--;
          }
          break;

        case State.COMMENT_LESS_THAN_SIGN_BANG:
          if (code === Code.DASH) {
            state = State.COMMENT_LESS_THAN_SIGN_BANG_DASH;
          } else {
            state = State.COMMENT;
            pos--;
          }
          break;

        case State.COMMENT_LESS_THAN_SIGN_BANG_DASH:
          if (code === Code.DASH) {
            state = State.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH;
          } else {
            state = State.COMMENT_END;
            pos--;
          }
          break;

        case State.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH:
          state = State.COMMENT_END;
          pos--;
          break;

        case State.COMMENT_END_DASH:
          if (code === Code.DASH) {
            state = State.COMMENT_END;
          } else {
            state = State.COMMENT;
            pos--;
          }
          break;

        case State.COMMENT_END:
          if (code === Code.GT) {
            state = State.DATA;
          } else if (code === Code.BANG) {
            state = State.COMMENT_END_BANG;
          } else if (code !== Code.DASH) {
            state = State.COMMENT;
            pos--;
          }
          break;

        case State.COMMENT_END_BANG:
          if (code === Code.DASH) {
            state = State.COMMENT_END_DASH;
          } else if (code === Code.GT) {
            state = State.DATA;
          } else {
            state = State.COMMENT;
            pos--;
          }
          break;

        case State.MARKUP_DECLARATION_OPEN:
          if (code === Code.DASH && string.charCodeAt(pos + 1) === Code.DASH) {
            state = State.COMMENT_START;
            pos++;
          } else {
            state = State.BOGUS_COMMENT;
            pos--;
          }
          break;

        default:
          state = State.UNKNOWN;
          break;
      }
    }

    // Figure out the next template part using the current state.
    if (stringi < strings.length - 1) {
      switch (state) {
        case State.DATA:
          // <a>$0
          parts[stringi] = LiteralPart.Node.instance;
          break;

        case State.BEFORE_ATTRIBUTE_NAME:
          // <a $0
          parts[stringi] = LiteralPart.Data.instance;
          break;

        case State.COMMENT:
          // <!-- $0
          parts[stringi] = LiteralPart.Comment.instance;
          break;

        case State.BEFORE_ATTRIBUTE_VALUE:
          // <a href=$0
          parts[stringi] = getAttributeLiteralPart(string);
          state = State.ATTRIBUTE_VALUE_UNQUOTED;
          break;

        case State.ATTRIBUTE_VALUE_UNQUOTED:
          // <a href=x$0
          parts[stringi] = getAttributeLiteralPart(string);
          break;

        case State.ATTRIBUTE_VALUE_SINGLE_QUOTED:
          // <a href='$0
          parts[stringi] = getAttributeLiteralPart(string);
          break;

        case State.ATTRIBUTE_VALUE_DOUBLE_QUOTED:
          // <a href="$0
          parts[stringi] = getAttributeLiteralPart(string);
          break;

        default: {
          let position = 0;
          for (let i = 0; i <= stringi; i++) {
            position += strings[i].length;
          }
          throw new Error(`Unexpected binding at position ${position}.`);
        }
      }
    }
  }

  Object.freeze(attributeValueParts);

  return parts;
}

/**
 * Renders an HTML string literal into a valid HTML string that can be processed
 * by the browser. Templated parts will be replaced by placeholders which can be
 * resolved using a `LiteralNodesFinder`.
 */
export function renderToHtml(strings: readonly string[], parts: readonly LiteralPart[]) {
  let htmlString = "";

  for (let i = 0, len = parts.length; i < len; i++) {
    htmlString += strings[i];

    const part = parts[i];

    if (part.type === LiteralPart.Kind.Attribute) {
      htmlString += "::";
    } else if (part.type === LiteralPart.Kind.Data) {
      htmlString += "::" + i + "=0";
    } else if (part.type === LiteralPart.Kind.Node) {
      htmlString += "<!--::" + i + "-->";
    } else {
      htmlString += "::comment_" + i;
    }
  }

  return htmlString + strings[strings.length - 1];
}

/**
 * An object used to find the nodes corresponding to the placeholders added by
 * `renderToHtml` when rendering templated parts.
 */
export class LiteralNodesFinder {
  private readonly whatToShow: number;
  private indices?: number[];

  public constructor(private readonly parts: readonly LiteralPart[]) {
    let whatToShow = 0;

    for (let i = 0, len = parts.length; i < len; i++) {
      const part = parts[i];

      if (part.type === LiteralPart.Kind.Comment || part.type === LiteralPart.Kind.Node) {
        whatToShow |= 128 /* SHOW_COMMENT */;
      } else {
        whatToShow |= 1 /* SHOW_ELEMENT */;
      }
    }

    this.whatToShow = whatToShow;
  }

  /**
   * Returns the nodes corresponding to the placeholders added to the DOM by
   * `renderToHtml`:
   * - For `Node` parts, the placeholder `Comment` node will be returned.
   * - For `Comment` parts, the `Comment` itself will be returned.
   * - For `Data` parts, the placeholder `Attr` will be returned.
   * - For `Attribute` parts, the `Attr` to which it is attached will be
   *   returned.
   */
  public find(root: Node) {
    const treeWalker = document.createTreeWalker(root, this.whatToShow, null),
          walker = new NodeWalker(treeWalker),
          parts = this.parts,
          foundNodes = new Array<Node>(parts.length);

    // Since the resulting HTML is always the same, we can guarantee that
    // calling `treeWalker.nextNode()` a given number of times will always
    // lead to the same node.
    // Therefore, the first time we find nodes based on their content, we also
    // save the number of checks we performed in `walker.skipUntilComment` and
    // `walker.skipUntilAttribute`. On subsequent calls to `find`, we can just
    // take the nodes that come after each checking each condition a given
    // number of times.
    // The tests ensure that the second, faster pass always returns the same
    // thing as the first, accurate pass.
    // By doing this, we avoid building intermediate strings and just have to
    // check counters.

    let currentIndex = 0,
        indices = this.indices;

    if (indices !== undefined) {
      for (let i = 0, len = indices.length; i < len; i++) {
        const nextIndex = indices[i],
              part = parts[i];

        if (part.type === LiteralPart.Kind.Node || part.type === LiteralPart.Kind.Comment) {
          foundNodes[i] = walker.skipComments(nextIndex - currentIndex)!;
          currentIndex = nextIndex;
        } else {
          foundNodes[i] = walker.skipAttributes(nextIndex - currentIndex)!;
          currentIndex = nextIndex;
        }
      }

      return foundNodes;
    }

    this.indices = indices = [];

    for (let i = 0, len = parts.length; i < len; i++) {
      const part = parts[i];

      if (part.type === LiteralPart.Kind.Node) {
        const expectedData = "::" + i;

        foundNodes[i] = walker.skipUntilComment((comment) => {
          currentIndex++;

          return comment.data === expectedData;
        })!;
        indices[i] = --currentIndex;
      } else if (part.type === LiteralPart.Kind.Comment) {
        const expectedData = "::comment_" + i;

        foundNodes[i] = walker.skipUntilComment((comment) => {
          currentIndex++;

          return comment.data.includes(expectedData);
        })!;
        indices[i] = --currentIndex;
      } else if (part.type === LiteralPart.Kind.Data) {
        const expectedAttributeName = "::" + i;

        foundNodes[i] = walker.skipUntilAttribute((attr) => {
          currentIndex++;

          return attr.name === expectedAttributeName;
        })!;
        indices[i] = --currentIndex;
      } else {
        if (part.index > 0) {
          foundNodes[i] = foundNodes[i - 1];
          indices[i] = indices[i - 1];
          continue;
        }

        const expectedAttributeValue = part.valueParts.join("::");

        foundNodes[i] = walker.skipUntilAttribute((attr) => {
          currentIndex++;

          return attr.value === expectedAttributeValue;
        })!;
        indices[i] = --currentIndex;
      }
    }

    return foundNodes;
  }

  /**
   * Shorthand for
   * `find(document.createRange().createContextualFragment(string))`.
   */
  public findInHtml(string: string) {
    return this.find(document.createRange().createContextualFragment(string));
  }
}

const enum Code {
  TAB = 9,
  LF = 10,
  FF = 12,
  CR = 13,
  SPACE = 32,
  UPPER_A = 65,
  UPPER_Z = 90,
  LOWER_A = 97,
  LOWER_Z = 122,
  LT = 60,
  GT = 62,
  SLASH = 47,
  DASH = 45,
  BANG = 33,
  EQ = 61,
  DQUOTE = 34,
  SQUOTE = 39,
  QUESTION = 63,
  COLON = 58,
}

const enum State {
  UNKNOWN = 0,
  DATA = 1,
  TAG_OPEN = 2,
  END_TAG_OPEN = 3,
  TAG_NAME = 4,
  BOGUS_COMMENT = 5,
  BEFORE_ATTRIBUTE_NAME = 6,
  AFTER_ATTRIBUTE_NAME = 7,
  ATTRIBUTE_NAME = 8,
  BEFORE_ATTRIBUTE_VALUE = 9,
  ATTRIBUTE_VALUE_DOUBLE_QUOTED = 10,
  ATTRIBUTE_VALUE_SINGLE_QUOTED = 11,
  ATTRIBUTE_VALUE_UNQUOTED = 12,
  AFTER_ATTRIBUTE_VALUE_QUOTED = 13,
  SELF_CLOSING_START_TAG = 14,
  COMMENT_START = 15,
  COMMENT_START_DASH = 16,
  COMMENT = 17,
  COMMENT_LESS_THAN_SIGN = 18,
  COMMENT_LESS_THAN_SIGN_BANG = 19,
  COMMENT_LESS_THAN_SIGN_BANG_DASH = 20,
  COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH = 21,
  COMMENT_END_DASH = 22,
  COMMENT_END = 23,
  COMMENT_END_BANG = 24,
  MARKUP_DECLARATION_OPEN = 25,
}

function isAsciiAlphaCode(code: number) {
  return (Code.UPPER_A <= code && code <= Code.UPPER_Z)
      || (Code.LOWER_A <= code && code <= Code.LOWER_Z);
}

function isSpaceCode(code: number) {
  return code === Code.TAB
      || code === Code.LF
      || code === Code.FF
      || code === Code.SPACE
      || code === Code.CR;
}

/**
 * A wrapper around a `TreeWalker` used to skip over nodes until a condition is
 * met.
 */
class NodeWalker {
  private attributeIndexHint = 0;

  public constructor(
    public readonly treeWalker: TreeWalker,
  ) {}

  /**
   * Skips over nodes until a comment matching the given condition is found, and
   * returns it.
   */
  public skipUntilComment(stopIf: (node: Comment) => boolean) {
    const walker = this.treeWalker;

    for (;;) {
      const node = walker.currentNode;

      if (node.nodeType === 8 /* COMMENT_NODE */ && stopIf(node as Comment)) {
        return node as Comment;
      }

      if (walker.nextNode() === null) {
        return undefined;
      }
    }
  }

  /**
   * Skips over attributes until an attribute matching the given condition is
   * found, and returns it.
   */
  public skipUntilAttribute(stopIf: (attr: Attr) => boolean) {
    const walker = this.treeWalker;

    for (;;) {
      const node = walker.currentNode;

      if (node.nodeType === 1 /* ELEMENT_NODE */) {
        const attributes = (node as Element).attributes;

        for (let i = this.attributeIndexHint, len = attributes.length; i < len; i++) {
          const attribute = attributes[i];

          if (stopIf(attribute)) {
            this.attributeIndexHint = i;

            return attribute;
          }
        }
      }

      if (walker.nextNode() === null) {
        return undefined;
      }

      this.attributeIndexHint = 0;
    }
  }

  /**
   * Skips over `n` comments.
   */
  public skipComments(n: number) {
    return this.skipUntilComment(() => n-- === 0);
  }

  /**
   * Skips over `n` attributes.
   */
  public skipAttributes(n: number) {
    return this.skipUntilAttribute(() => n-- === 0);
  }
}
