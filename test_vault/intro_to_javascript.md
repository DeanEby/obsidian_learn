---
uuid: 3c919967-8047-4114-bffb-c7d7541b2a75
---

[[javascript]]
[[codesmith_PTRI_open_house]]
[[Programming]]


## Introduction Videos
### Variables
Everything in JavaScript is done in either the Global Execution Context or in the Global Memory.
Global Memory is where data is stored and assigned to variables.

The Global Execution Context is where the control flow and other conditional logic like looping is done.

You do not want to use `var` in javascript. Instead you should use `let` or `const`.

`let example = 1;` This assigns the value 1 to the variable `example`.
`const example2 = 2;` This assigns the value 2 to the constant `example2`
`const exampleArray = [1, 2, '3', 4];` This assigns an array to the constant `exampleArray` which contains the numbers 1, 2, and 4, as well as the string `3`.

### Control Flow:

``` JS
if (myNum <= 10) {
	console.log(myNum + ' is a small number');
} else if (myNum <= 20) {
	console.log(myNum + ' is a medium number');
} else {
	console.log(myNum + ' is huge!');
}
```
This bit of code checks to see the size of the number assigned to `myNum`. Based on what `myNum` is it will execute different code blocks.

Equality in JavaScript:
	`x==y` This will attempt to convert and compare operands of different type
	`x===y` Strict Equality: This will compare operands that must be of the same type
	It is better to use strict equality.
	`x!==y` Strict inequality

### Looping:
``` JS
const abc = ['a', 'b', 'c'];
for (let i = 0; i < abc.length; i++){
	console.log(abc[i]);
}
```
This bit of code will iterate through all of the values in the array `abc` and print them to the console.


You want to avoid nesting loops whenever possible, as this will greatly increase your time complexity.
A common way to avoid using nested loops is using pointers. This can allow you to use one for loop to do the job of two.
[[things_to_research]]


### Functions:
``` js
function aPlusB(a, b) {
	return a + b;
}

let num1 = 2;
let num2 = 3;

let sum = aPlusB(num1, num2);

```
