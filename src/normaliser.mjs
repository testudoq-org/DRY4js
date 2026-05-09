/**
 * normaliser.mjs
 * Converts a Babel AST node into a deterministic, minimal NormNode tree.
 *
 * Rules:
 *  - All identifiers → ":symbol"
 *  - All literals (string/number/boolean/null/regex) → ":literal"
 *  - Structural type tags are preserved
 *  - Child traversal order is FIXED and explicit (never Object.keys())
 */

/**
 * @typedef {{ type: string, children: NormNode[] }} NormNode
 */

/**
 * Normalise a Babel AST node into a NormNode.
 *
 * @param {import('@babel/types').Node|null|undefined} node
 * @returns {NormNode}
 */
export function normalise(node) {
  if (node == null) return { type: ':null', children: [] };
  return normaliseNode(node);
}

/**
 * Serialise a NormNode to a compact JSON string (for fingerprinting).
 *
 * @param {NormNode} normNode
 * @returns {string}
 */
export function serialise(normNode) {
  return JSON.stringify(normNode);
}

// ---------------------------------------------------------------------------
// Internal dispatch
// ---------------------------------------------------------------------------

/** @param {import('@babel/types').Node} node */
function normaliseNode(node) {
  switch (node.type) {
    // ── Declarations ──────────────────────────────────────────────────────
    case 'FunctionDeclaration':
    case 'FunctionExpression':
      return normFunction(node);
    case 'ArrowFunctionExpression':
      return normArrow(node);
    case 'VariableDeclaration':
      return normVariableDeclaration(node);
    case 'VariableDeclarator':
      return normVariableDeclarator(node);
    case 'ClassDeclaration':
    case 'ClassExpression':
      return normClass(node);
    case 'ClassBody':
      return normClassBody(node);
    case 'ClassMethod':
    case 'ObjectMethod':
      return normMethod(node);
    case 'ClassProperty':
    case 'ClassPrivateProperty':
      return normClassProperty(node);

    // ── Statements ────────────────────────────────────────────────────────
    case 'BlockStatement':
      return normBlock(node);
    case 'ReturnStatement':
      return normUnary('ReturnStatement', node.argument);
    case 'ExpressionStatement':
      return normUnary('ExpressionStatement', node.expression);
    case 'IfStatement':
      return normIf(node);
    case 'WhileStatement':
      return normBinary('WhileStatement', node.test, node.body);
    case 'DoWhileStatement':
      return normBinary('DoWhileStatement', node.body, node.test);
    case 'ForStatement':
      return normFor(node);
    case 'ForInStatement':
      return normBinary('ForInStatement', node.left, node.body);
    case 'ForOfStatement':
      return normBinary('ForOfStatement', node.left, node.body);
    case 'SwitchStatement':
      return normSwitch(node);
    case 'SwitchCase':
      return normSwitchCase(node);
    case 'TryStatement':
      return normTry(node);
    case 'CatchClause':
      return normUnary('CatchClause', node.body);
    case 'ThrowStatement':
      return normUnary('ThrowStatement', node.argument);
    case 'BreakStatement':
    case 'ContinueStatement':
      return { type: node.type, children: [] };
    case 'LabeledStatement':
      return normUnary('LabeledStatement', node.body);

    // ── Expressions ───────────────────────────────────────────────────────
    case 'CallExpression':
    case 'OptionalCallExpression':
      return normCall(node);
    case 'NewExpression':
      return normCall({ ...node, type: 'NewExpression' });
    case 'AssignmentExpression':
      return normBinaryExpr('AssignmentExpression', node.left, node.right);
    case 'BinaryExpression':
    case 'LogicalExpression':
      return normBinaryExpr(node.type, node.left, node.right);
    case 'UnaryExpression':
    case 'UpdateExpression':
      return normUnary(node.type, node.argument);
    case 'ConditionalExpression':
      return normTernary(node);
    case 'MemberExpression':
    case 'OptionalMemberExpression':
      return normMember(node);
    case 'ArrayExpression':
      return normArray(node);
    case 'ObjectExpression':
      return normObject(node);
    case 'ObjectProperty':
      return normObjectProperty(node);
    case 'SpreadElement':
      return normUnary('SpreadElement', node.argument);
    case 'TemplateLiteral':
      return { type: ':literal', children: [] };
    case 'TaggedTemplateExpression':
      return normBinaryExpr('TaggedTemplateExpression', node.tag, node.quasi);
    case 'AwaitExpression':
      return normUnary('AwaitExpression', node.argument);
    case 'YieldExpression':
      return normUnary('YieldExpression', node.argument);
    case 'SequenceExpression':
      return normChildren('SequenceExpression', node.expressions);

    // ── Patterns ──────────────────────────────────────────────────────────
    case 'AssignmentPattern':
      return normBinaryExpr('AssignmentPattern', node.left, node.right);
    case 'RestElement':
      return normUnary('RestElement', node.argument);
    case 'ArrayPattern':
      return normChildren('ArrayPattern', node.elements.filter(Boolean));
    case 'ObjectPattern':
      return normChildren('ObjectPattern', node.properties);

    // ── Imports / Exports ─────────────────────────────────────────────────
    case 'ImportDeclaration':
      return { type: 'ImportDeclaration', children: [] };
    case 'ExportNamedDeclaration':
      return node.declaration
        ? normUnary('ExportNamedDeclaration', node.declaration)
        : { type: 'ExportNamedDeclaration', children: [] };
    case 'ExportDefaultDeclaration':
      return normUnary('ExportDefaultDeclaration', node.declaration);
    case 'ExportAllDeclaration':
      return { type: 'ExportAllDeclaration', children: [] };

    // ── Identifiers & Literals ────────────────────────────────────────────
    case 'Identifier':
    case 'PrivateName':
      return { type: ':symbol', children: [] };
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
    case 'RegExpLiteral':
    case 'BigIntLiteral':
    case 'DecimalLiteral':
      return { type: ':literal', children: [] };

    // ── TypeScript (keep structure, drop type annotations) ────────────────
    case 'TSTypeAnnotation':
    case 'TSTypeReference':
    case 'TSPropertySignature':
    case 'TSMethodSignature':
    case 'TSInterfaceDeclaration':
    case 'TSTypeAliasDeclaration':
    case 'TSEnumDeclaration':
      return { type: node.type, children: [] };

    // ── JSX ───────────────────────────────────────────────────────────────
    case 'JSXElement':
      return normJSXElement(node);
    case 'JSXFragment':
      return normChildren('JSXFragment', node.children);
    case 'JSXExpressionContainer':
      return normUnary('JSXExpressionContainer', node.expression);
    case 'JSXText':
      return { type: ':literal', children: [] };
    case 'JSXSpreadChild':
      return normUnary('JSXSpreadChild', node.expression);

    default:
      // Unknown node: preserve type, normalise known children if present
      return { type: node.type, children: [] };
  }
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function normChildren(type, nodes) {
  return { type, children: nodes.map(normaliseNode) };
}

function normUnary(type, child) {
  return { type, children: child ? [normaliseNode(child)] : [] };
}

function normBinary(type, a, b) {
  return { type, children: [normaliseNode(a), normaliseNode(b)] };
}

function normBinaryExpr(type, left, right) {
  return { type, children: [normaliseNode(left), normaliseNode(right)] };
}

function normTernary(node) {
  return {
    type: 'ConditionalExpression',
    children: [normaliseNode(node.test), normaliseNode(node.consequent), normaliseNode(node.alternate)],
  };
}

function normBlock(node) {
  return { type: 'BlockStatement', children: node.body.map(normaliseNode) };
}

function normFunction(node) {
  // params first (fixed order), then body
  const children = [
    ...node.params.map(normaliseNode),
    normaliseNode(node.body),
  ];
  return { type: node.type, children };
}

function normArrow(node) {
  const children = [
    ...node.params.map(normaliseNode),
    normaliseNode(node.body),
  ];
  return { type: 'ArrowFunctionExpression', children };
}

function normVariableDeclaration(node) {
  return { type: 'VariableDeclaration', children: node.declarations.map(normVariableDeclarator) };
}

function normVariableDeclarator(node) {
  return {
    type: 'VariableDeclarator',
    children: node.init ? [normaliseNode(node.id), normaliseNode(node.init)] : [normaliseNode(node.id)],
  };
}

function normClass(node) {
  const children = [];
  if (node.superClass) children.push(normaliseNode(node.superClass));
  children.push(normaliseNode(node.body));
  return { type: node.type, children };
}

function normClassBody(node) {
  return { type: 'ClassBody', children: node.body.map(normaliseNode) };
}

function normMethod(node) {
  const children = [
    ...node.params.map(normaliseNode),
    normaliseNode(node.body),
  ];
  return { type: node.type, children };
}

function normClassProperty(node) {
  return {
    type: node.type,
    children: node.value ? [normaliseNode(node.value)] : [],
  };
}

function normIf(node) {
  const children = [normaliseNode(node.test), normaliseNode(node.consequent)];
  if (node.alternate) children.push(normaliseNode(node.alternate));
  return { type: 'IfStatement', children };
}

function normFor(node) {
  const children = [];
  if (node.init) children.push(normaliseNode(node.init));
  if (node.test) children.push(normaliseNode(node.test));
  if (node.update) children.push(normaliseNode(node.update));
  children.push(normaliseNode(node.body));
  return { type: 'ForStatement', children };
}

function normSwitch(node) {
  return {
    type: 'SwitchStatement',
    children: [normaliseNode(node.discriminant), ...node.cases.map(normaliseNode)],
  };
}

function normSwitchCase(node) {
  const children = node.test ? [normaliseNode(node.test)] : [];
  children.push(...node.consequent.map(normaliseNode));
  return { type: 'SwitchCase', children };
}

function normTry(node) {
  const children = [normaliseNode(node.block)];
  if (node.handler) children.push(normaliseNode(node.handler));
  if (node.finalizer) children.push(normaliseNode(node.finalizer));
  return { type: 'TryStatement', children };
}

function normCall(node) {
  // Preserve callee shape (head position) + arguments
  const children = [
    normaliseNode(node.callee),
    ...node.arguments.map(normaliseNode),
  ];
  return { type: node.type, children };
}

function normMember(node) {
  return {
    type: 'MemberExpression',
    children: [normaliseNode(node.object)],
  };
}

function normArray(node) {
  return {
    type: 'ArrayExpression',
    children: node.elements.filter(Boolean).map(normaliseNode),
  };
}

function normObject(node) {
  return {
    type: 'ObjectExpression',
    children: node.properties.map(normaliseNode),
  };
}

function normObjectProperty(node) {
  return {
    type: 'ObjectProperty',
    children: [normaliseNode(node.value)],
  };
}

function normJSXElement(node) {
  return {
    type: 'JSXElement',
    children: node.children.map(normaliseNode),
  };
}
