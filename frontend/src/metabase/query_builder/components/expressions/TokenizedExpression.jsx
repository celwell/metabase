import React from "react";

import "./TokenizedExpression.css";

import cx from "classnames";

import { parse as parseExpression } from "metabase/lib/expressions/syntax";

export default class TokenizedExpression extends React.Component {
  render() {
    try {
      const parsed = parseExpression(this.props.source, this.props.parserInfo);
      return renderSyntaxTree(parsed);
    } catch (e) {
      console.warn("parse error", e);
      return <span className="Expression-node">{this.props.source}</span>;
    }
  }
}

const renderSyntaxTree = (node, index) => (
  <span
    key={index}
    className={cx("Expression-node", "Expression-" + node.type, {
      "Expression-tokenized": node.tokenized,
    })}
  >
    {node.text != null
      ? node.text
      : node.children
      ? node.children.map(renderSyntaxTree)
      : null}
  </span>
);

function nextNonWhitespace(tokens, index) {
  while (index < tokens.length && /^\s+$/.test(tokens[++index])) {
    // this block intentionally left blank
  }
  return tokens[index];
}

export function parse(expressionString) {
  const tokens = (expressionString || " ").match(
    /[a-zA-Z]\w*|"(?:[^\\"]+|\\(?:[bfnrtv"\\/]|u[0-9a-fA-F]{4}))*"|\(|\)|\d+|\s+|[*/+-]|.+/g,
  );

  const root = { type: "group", children: [] };
  let current = root;
  let outsideAggregation = true;
  const stack = [];
  const push = element => {
    current.children.push(element);
    stack.push(current);
    current = element;
  };
  const pop = () => {
    if (stack.length === 0) {
      return;
    }
    current = stack.pop();
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^[a-zA-Z]\w*$/.test(token)) {
      if (nextNonWhitespace(tokens, i) === "(") {
        outsideAggregation = false;
        push({
          type: "aggregation",
          tokenized: true,
          children: [],
        });
        current.children.push({
          type: "aggregation-name",
          text: token,
        });
      } else {
        current.children.push({
          type: outsideAggregation ? "metric" : "field",
          tokenized: true,
          text: token,
        });
      }
    } else if (
      /^"(?:[^\\"]+|\\(?:[bfnrtv"\\/]|u[0-9a-fA-F]{4}))*"$/.test(token)
    ) {
      current.children.push({
        type: "identifier-string",
        tokenized: true,
        children: [
          { type: "open-quote", text: '"' },
          {
            type: outsideAggregation ? "metric" : "field",
            text: JSON.parse(token),
          },
          { type: "close-quote", text: '"' },
        ],
      });
    } else if (token === "(") {
      push({ type: "group", children: [] });
      current.children.push({ type: "open-paren", text: "(" });
    } else if (token === ")") {
      current.children.push({ type: "close-paren", text: ")" });
      pop();
      if (current.type === "aggregation") {
        outsideAggregation = true;
        pop();
      }
    } else {
      // special handling for unclosed string literals
      if (i === tokens.length - 1 && /^".+[^"]$/.test(token)) {
        current.children.push({
          type: "string-literal",
          tokenized: true,
          children: [
            { type: "open-quote", text: '"' },
            {
              type: outsideAggregation ? "metric" : "field",
              text: JSON.parse(token + '"'),
            },
          ],
        });
      } else {
        current.children.push({ type: "token", text: token });
      }
    }
  }
  return root;
}
