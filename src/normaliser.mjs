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

const literalNode = () => ({ type: ':literal', children: [] });
const symbolNode = () => ({ type: ':symbol', children: [] });
const emptyNode = (type) => ({ type, children: [] });

const NORMALISERS = {
  FunctionDeclaration: normFunction,
  FunctionExpression: normFunction,
  ArrowFunctionExpression: normArrow,
  VariableDeclaration: normVariableDeclaration,
  VariableDeclarator: normVariableDeclarator,
  ClassDeclaration: normClass,
  ClassExpression: normClass,
  ClassBody: normClassBody,
  ClassMethod: normMethod,
  ClassPrivateMethod: normMethod,
  ObjectMethod: normMethod,
  ClassProperty: normClassProperty,
  ClassPrivateProperty: normClassProperty,
  BlockStatement: normBlock,
  ReturnStatement: (node) => normUnary('ReturnStatement', node.argument),
  ExpressionStatement: (node) => normUnary('ExpressionStatement', node.expression),
  IfStatement: normIf,
  WhileStatement: (node) => normBinary('WhileStatement', node.test, node.body),
  DoWhileStatement: (node) => normBinary('DoWhileStatement', node.body, node.test),
  ForStatement: normFor,
  ForInStatement: (node) => normBinary('ForInStatement', node.left, node.body),
  ForOfStatement: (node) => normBinary('ForOfStatement', node.left, node.body),
  SwitchStatement: normSwitch,
  SwitchCase: normSwitchCase,
  TryStatement: normTry,
  CatchClause: (node) => normUnary('CatchClause', node.body),
  ThrowStatement: (node) => normUnary('ThrowStatement', node.argument),
  BreakStatement: () => emptyNode('BreakStatement'),
  ContinueStatement: () => emptyNode('ContinueStatement'),
  LabeledStatement: (node) => normUnary('LabeledStatement', node.body),
  CallExpression: normCall,
  OptionalCallExpression: normCall,
  NewExpression: (node) => normCall({ ...node, type: 'NewExpression' }),
  AssignmentExpression: (node) => normBinaryExpr('AssignmentExpression', node.left, node.right),
  BinaryExpression: (node) => normBinaryExpr('BinaryExpression', node.left, node.right),
  LogicalExpression: (node) => normBinaryExpr('LogicalExpression', node.left, node.right),
  UnaryExpression: (node) => normUnary('UnaryExpression', node.argument),
  UpdateExpression: (node) => normUnary('UpdateExpression', node.argument),
  ConditionalExpression: normTernary,
  MemberExpression: normMember,
  OptionalMemberExpression: normMember,
  ArrayExpression: normArray,
  ObjectExpression: normObject,
  ObjectProperty: normObjectProperty,
  SpreadElement: (node) => normUnary('SpreadElement', node.argument),
  TemplateLiteral: literalNode,
  TaggedTemplateExpression: (node) => normBinaryExpr('TaggedTemplateExpression', node.tag, node.quasi),
  AwaitExpression: (node) => normUnary('AwaitExpression', node.argument),
  YieldExpression: (node) => normUnary('YieldExpression', node.argument),
  SequenceExpression: (node) => normChildren('SequenceExpression', node.expressions),
  AssignmentPattern: (node) => normBinaryExpr('AssignmentPattern', node.left, node.right),
  RestElement: (node) => normUnary('RestElement', node.argument),
  ArrayPattern: (node) => normChildren('ArrayPattern', node.elements.filter(Boolean)),
  ObjectPattern: (node) => normChildren('ObjectPattern', node.properties),
  ImportDeclaration: () => emptyNode('ImportDeclaration'),
  ExportNamedDeclaration: (node) => (
    node.declaration
      ? normUnary('ExportNamedDeclaration', node.declaration)
      : emptyNode('ExportNamedDeclaration')
  ),
  ExportDefaultDeclaration: (node) => normUnary('ExportDefaultDeclaration', node.declaration),
  ExportAllDeclaration: () => emptyNode('ExportAllDeclaration'),
  Identifier: symbolNode,
  PrivateName: symbolNode,
  StringLiteral: literalNode,
  NumericLiteral: literalNode,
  BooleanLiteral: literalNode,
  NullLiteral: literalNode,
  RegExpLiteral: literalNode,
  BigIntLiteral: literalNode,
  DecimalLiteral: literalNode,
  TSTypeAnnotation: (node) => emptyNode(node.type),
  TSTypeReference: (node) => emptyNode(node.type),
  TSPropertySignature: (node) => emptyNode(node.type),
  TSMethodSignature: (node) => emptyNode(node.type),
  TSInterfaceDeclaration: (node) => emptyNode(node.type),
  TSTypeAliasDeclaration: (node) => emptyNode(node.type),
  TSEnumDeclaration: (node) => emptyNode(node.type),
  JSXElement: normJSXElement,
  JSXFragment: (node) => normChildren('JSXFragment', node.children),
  JSXExpressionContainer: (node) => normUnary('JSXExpressionContainer', node.expression),
  JSXText: literalNode,
  JSXSpreadChild: (node) => normUnary('JSXSpreadChild', node.expression),
};

/** @param {import('@babel/types').Node} node */
function normaliseNode(node) {
  const handler = NORMALISERS[node.type];
  return handler ? handler(node) : { type: node.type, children: [] };
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function normChildren(type, nodes) {
  return { type, children: nodes.map(normaliseNode) };
}

function normNodeList(type, nodes) {
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
  return normNodeList('BlockStatement', node.body);
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
  return normNodeList('ClassBody', node.body);
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
  return normNodeList('ArrayExpression', node.elements.filter(Boolean));
}

function normObject(node) {
  return normNodeList('ObjectExpression', node.properties);
}

function normObjectProperty(node) {
  return {
    type: 'ObjectProperty',
    children: [normaliseNode(node.value)],
  };
}

function normJSXElement(node) {
  return normNodeList('JSXElement', node.children);
}
