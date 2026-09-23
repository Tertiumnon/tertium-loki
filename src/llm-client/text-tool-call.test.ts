import { describe, expect, test } from "bun:test";
import { holdBackPossibleToolCall, mightBeTextToolCall, parseTextToolCall } from "./text-tool-call";

const tools = new Set(["get_weather", "fetch_url"]);

describe("parseTextToolCall", () => {
  test("recognises bare, tag-wrapped, and fenced JSON calls to known tools", () => {
    const expected = { name: "get_weather", args: { location: "Kyiv" } };
    expect(parseTextToolCall('{"name": "get_weather", "arguments": {"location": "Kyiv"}}', tools)).toEqual(expected);
    expect(
      parseTextToolCall('<tools>\n{"name": "get_weather", "arguments": {"location": "Kyiv"}}\n</tools>', tools),
    ).toEqual(expected);
    expect(
      parseTextToolCall('```json\n{"name": "get_weather", "parameters": {"location": "Kyiv"}}\n```', tools),
    ).toEqual(expected);
  });

  test("ignores ordinary replies, unknown tools, and JSON that isn't a call", () => {
    expect(parseTextToolCall("It is sunny.", tools)).toBeUndefined();
    expect(parseTextToolCall('{"name": "rm_rf", "arguments": {}}', tools)).toBeUndefined();
    expect(parseTextToolCall('{"a": 1}', tools)).toBeUndefined();
  });
});

describe("holdBackPossibleToolCall", () => {
  test("streams ordinary text through, holds JSON-looking text until flushed", () => {
    const out: string[] = [];
    const plain = holdBackPossibleToolCall((t) => out.push(t));
    plain.onToken("Hello");
    plain.onToken(" world");
    expect(out.join("")).toBe("Hello world");

    out.length = 0;
    const json = holdBackPossibleToolCall((t) => out.push(t));
    json.onToken('{"name"');
    expect(out).toEqual([]);
    json.flush();
    expect(out.join("")).toBe('{"name"');
  });
});

describe("mightBeTextToolCall", () => {
  test("holds split openers but releases code fences and prose", () => {
    expect(mightBeTextToolCall("<")).toBe(true);
    expect(mightBeTextToolCall("```")).toBe(true);
    expect(mightBeTextToolCall("```json\n{")).toBe(true);
    expect(mightBeTextToolCall("```python")).toBe(false);
    expect(mightBeTextToolCall("Sure")).toBe(false);
  });
});

describe("parseTextToolCall with lead-in prose", () => {
  test("accepts a call that ends the reply, but not one in the middle", () => {
    const trailing =
      'To find the weather I\'ll call get_weather.\n\n<json>\n{\n  "name": "get_weather",\n  "arguments": {"location": "Kyiv"}\n}\n</json>';
    expect(parseTextToolCall(trailing, tools)).toEqual({ name: "get_weather", args: { location: "Kyiv" } });

    const middle = 'The API looks like {"name": "get_weather", "arguments": {}} and returns text.';
    expect(parseTextToolCall(middle, tools)).toBeUndefined();
  });
});
