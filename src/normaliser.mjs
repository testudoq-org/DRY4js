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
 * @param {{ semantic?: boolean, stableSymbols?: boolean }} [options]
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

function createNormaliserContext({ semantic = false, stableSymbols = false } = {}) {
  return {
    semantic,
    stableSymbols,
    symbolMap: new Map(),
    nextSymbolId: 0,
  };
}

// ---------------------------------------------------------------------------
// Internal dispatch
// ---------------------------------------------------------------------------

const literalNode = (node, context) => formatLiteral(node, context);
const symbolNode = (node, context) => ({
  type: context.stableSymbols ? mapSymbol(node, context) : ':symbol',
  children: [],
});
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
  ReturnStatement: (node, context) => normUnary('ReturnStatement', node.argument, context),
  ExpressionStatement: (node, context) => normUnary('ExpressionStatement', node.expression, context),
  IfStatement: normIf,
  WhileStatement: (node, context) => normBinary('WhileStatement', node.test, node.body, context),
  DoWhileStatement: (node, context) => normBinary('DoWhileStatement', node.body, node.test, context),
  ForStatement: normFor,
  ForInStatement: (node, context) => normBinary('ForInStatement', node.left, node.body, context),
  ForOfStatement: (node, context) => normBinary('ForOfStatement', node.left, node.body, context),
  SwitchStatement: normSwitch,
  SwitchCase: normSwitchCase,
  TryStatement: normTry,
  CatchClause: (node, context) => normUnary('CatchClause', node.body, context),
  ThrowStatement: (node, context) => normUnary('ThrowStatement', node.argument, context),
  BreakStatement: () => emptyNode('BreakStatement'),
  ContinueStatement: () => emptyNode('ContinueStatement'),
  LabeledStatement: (node, context) => normUnary('LabeledStatement', node.body, context),
  CallExpression: normCall,
  OptionalCallExpression: normCall,
  NewExpression: (node, context) => normCall({ ...node, type: 'NewExpression' }, context),
  AssignmentExpression: (node, context) => normBinaryExpr('AssignmentExpression', node.left, node.right, context),
  BinaryExpression: (node, context) => normBinaryExpr('BinaryExpression', node.left, node.right, context),
  LogicalExpression: (node, context) => normBinaryExpr('LogicalExpression', node.left, node.right, context),
  UnaryExpression: (node, context) => normUnary('UnaryExpression', node.argument, context),
  UpdateExpression: (node, context) => normUnary('UpdateExpression', node.argument, context),
  ConditionalExpression: normTernary,
  MemberExpression: normMember,
  OptionalMemberExpression: normMember,
  ArrayExpression: normArray,
  ObjectExpression: normObject,
  ObjectProperty: normObjectProperty,
  SpreadElement: (node, context) => normUnary('SpreadElement', node.argument, context),
  TemplateLiteral: literalNode,
  TaggedTemplateExpression: (node, context) => normBinaryExpr('TaggedTemplateExpression', node.tag, node.quasi, context),
  AwaitExpression: (node, context) => normUnary('AwaitExpression', node.argument, context),
  YieldExpression: (node, context) => normUnary('YieldExpression', node.argument, context),
  SequenceExpression: (node, context) => normChildren('SequenceExpression', node.expressions, context),
  AssignmentPattern: (node, context) => normBinaryExpr('AssignmentPattern', node.left, node.right, context),
  RestElement: (node, context) => normUnary('RestElement', node.argument, context),
  ArrayPattern: (node, context) => normChildren('ArrayPattern', node.elements.filter(Boolean), context),
  ObjectPattern: (node, context) => normChildren('ObjectPattern', node.properties, context),
  ImportDeclaration: () => emptyNode('ImportDeclaration'),
  ExportNamedDeclaration: (node, context) => (
    node.declaration
      ? normUnary('ExportNamedDeclaration', node.declaration, context)
      : emptyNode('ExportNamedDeclaration')
  ),
  ExportDefaultDeclaration: (node, context) => normUnary('ExportDefaultDeclaration', node.declaration, context),
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
  JSXFragment: (node, context) => normChildren('JSXFragment', node.children, context),
  JSXExpressionContainer: (node, context) => normUnary('JSXExpressionContainer', node.expression, context),
  JSXText: literalNode,
  JSXSpreadChild: (node, context) => normUnary('JSXSpreadChild', node.expression, context),
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
