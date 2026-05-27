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
export function normalise(node, options = {}) {
  if (node == null) return { type: ':null', children: [] };
  const context = createNormaliserContext(options);
  return normaliseNode(node, context);
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

function createNormaliserContext({ semantic = false } = {}) {
  return {
    semantic,
    symbolMap: new Map(),
    nextSymbolId: 0,
  };
}

// ---------------------------------------------------------------------------
// Internal dispatch
// ---------------------------------------------------------------------------

const literalNode = (node, context) => formatLiteral(node, context);
const symbolNode = (node, context) => ({ type: mapSymbol(node, context), children: [] });
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
function normaliseNode(node, context) {
  const handler = NORMALISERS[node.type];
  return handler ? handler(node, context) : { type: node.type, children: [] };
}

function mapSymbol(node, context) {
  const name = node.type === 'PrivateName' ? node.id.name : node.name;
  if (!context.symbolMap.has(name)) {
    context.symbolMap.set(name, `:symbol${context.nextSymbolId++}`);
  }
  return context.symbolMap.get(name);
}

function formatLiteral(node, context) {
  if (!context.semantic) return { type: ':literal', children: [] };

  switch (node.type) {
    case 'BooleanLiteral':
      return { type: `:literal-boolean-${node.value}`, children: [] };
    case 'NullLiteral':
      return { type: ':literal-null', children: [] };
    case 'NumericLiteral': {
      const value = node.value;
      return Number.isFinite(value) && Math.abs(value) <= 1
        ? { type: `:literal-number-${value}`, children: [] }
        : { type: ':literal', children: [] };
    }
    case 'StringLiteral': {
      const value = node.value;
      return value.length <= 4
        ? { type: `:literal-string-${value}`, children: [] }
        : { type: ':literal', children: [] };
    }
    default:
      return { type: ':literal', children: [] };
  }
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function normChildren(type, nodes, context) {
  return { type, children: nodes.map((child) => normaliseNode(child, context)) };
}

function normNodeList(type, nodes, context) {
  return { type, children: nodes.map((child) => normaliseNode(child, context)) };
}

function normUnary(type, child, context) {
  return { type, children: child ? [normaliseNode(child, context)] : [] };
}

function normBinary(type, a, b, context) {
  return { type, children: [normaliseNode(a, context), normaliseNode(b, context)] };
}

function normBinaryExpr(type, left, right, context) {
  return { type, children: [normaliseNode(left, context), normaliseNode(right, context)] };
}

function normTernary(node, context) {
  return {
    type: 'ConditionalExpression',
    children: [normaliseNode(node.test, context), normaliseNode(node.consequent, context), normaliseNode(node.alternate, context)],
  };
}

function normBlock(node, context) {
  return normNodeList('BlockStatement', node.body, context);
}

function normFunction(node, context) {
  const children = [
    ...node.params.map((param) => normaliseNode(param, context)),
    normaliseNode(node.body, context),
  ];
  return { type: node.type, children };
}

function normArrow(node, context) {
  const children = [
    ...node.params.map((param) => normaliseNode(param, context)),
    normaliseNode(node.body, context),
  ];
  return { type: 'ArrowFunctionExpression', children };
}

function normVariableDeclaration(node, context) {
  return { type: 'VariableDeclaration', children: node.declarations.map((declarator) => normVariableDeclarator(declarator, context)) };
}

function normVariableDeclarator(node, context) {
  return {
    type: 'VariableDeclarator',
    children: node.init ? [normaliseNode(node.id, context), normaliseNode(node.init, context)] : [normaliseNode(node.id, context)],
  };
}

function normClass(node, context) {
  const children = [];
  if (node.superClass) children.push(normaliseNode(node.superClass, context));
  children.push(normaliseNode(node.body, context));
  return { type: node.type, children };
}

function normClassBody(node, context) {
  return normNodeList('ClassBody', node.body, context);
}

function normMethod(node, context) {
  const children = [
    ...node.params.map((param) => normaliseNode(param, context)),
    normaliseNode(node.body, context),
  ];
  return { type: node.type, children };
}

function normClassProperty(node, context) {
  return {
    type: node.type,
    children: node.value ? [normaliseNode(node.value, context)] : [],
  };
}

function normIf(node, context) {
  const children = [normaliseNode(node.test, context), normaliseNode(node.consequent, context)];
  if (node.alternate) children.push(normaliseNode(node.alternate, context));
  return { type: 'IfStatement', children };
}

function normFor(node, context) {
  const children = [];
  if (node.init) children.push(normaliseNode(node.init, context));
  if (node.test) children.push(normaliseNode(node.test, context));
  if (node.update) children.push(normaliseNode(node.update, context));
  children.push(normaliseNode(node.body, context));
  return { type: 'ForStatement', children };
}

function normSwitch(node, context) {
  return {
    type: 'SwitchStatement',
    children: [normaliseNode(node.discriminant, context), ...node.cases.map((item) => normaliseNode(item, context))],
  };
}

function normSwitchCase(node, context) {
  const children = node.test ? [normaliseNode(node.test, context)] : [];
  children.push(...node.consequent.map((child) => normaliseNode(child, context)));
  return { type: 'SwitchCase', children };
}

function normTry(node, context) {
  const children = [normaliseNode(node.block, context)];
  if (node.handler) children.push(normaliseNode(node.handler, context));
  if (node.finalizer) children.push(normaliseNode(node.finalizer, context));
  return { type: 'TryStatement', children };
}

function normCall(node, context) {
  const children = [normaliseNode(node.callee, context), ...node.arguments.map((arg) => normaliseNode(arg, context))];
  return { type: node.type, children };
}

function normMember(node, context) {
  return {
    type: 'MemberExpression',
    children: [normaliseNode(node.object, context)],
  };
}

function normArray(node, context) {
  return normNodeList('ArrayExpression', node.elements.filter(Boolean), context);
}

function normObject(node, context) {
  return normNodeList('ObjectExpression', node.properties, context);
}

function normObjectProperty(node, context) {
  return {
    type: 'ObjectProperty',
    children: [normaliseNode(node.value, context)],
  };
}

function normJSXElement(node, context) {
  return normNodeList('JSXElement', node.children, context);
}
