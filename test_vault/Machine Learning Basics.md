# Machine Learning Basics

## What is Machine Learning?

Machine learning is a branch of artificial intelligence (AI) and computer science which focuses on the use of data and algorithms to imitate the way that humans learn, gradually improving its accuracy.

IBM has defined machine learning as "a branch of artificial intelligence and computer science which focuses on the use of data and algorithms to imitate the way that humans learn, gradually improving its accuracy."

Key distinctions in machine learning include:

- **Supervised Learning**: Training a model on labeled data
- **Unsupervised Learning**: Finding patterns in unlabeled data
- **Reinforcement Learning**: Training agents through rewards and penalties

## Supervised Learning

Supervised learning is the machine learning task of learning a function that maps an input to an output based on example input-output pairs. It infers a function from labeled training data.

Common supervised learning algorithms include:

### Linear Regression

Linear regression attempts to model the relationship between variables by fitting a linear equation to observed data. It's used for predicting continuous values.

The simple linear regression equation can be represented as:
y = mx + b

Where:
- y is the dependent variable (prediction)
- x is the independent variable
- m is the slope
- b is the y-intercept

### Logistic Regression

Logistic regression is used for binary classification problems. It uses a logistic function to model a binary dependent variable.

The logistic function (sigmoid) is represented as:
P(y=1) = 1 / (1 + e^(-z))

Where z is the linear function of the independent variables.

### Support Vector Machines

SVMs are powerful for both classification and regression tasks. They work by finding the hyperplane that best divides a dataset into classes.

### Decision Trees and Random Forests

Decision trees use a tree-like model of decisions where each node represents a feature, each branch represents a decision rule, and each leaf represents an outcome.

Random forests are an ensemble learning method that operate by constructing multiple decision trees during training.

## Unsupervised Learning

Unsupervised learning is where algorithms find patterns in data without predefined labels.

Common unsupervised learning algorithms include:

### Clustering

K-means clustering partitions data into k clusters, with each observation belonging to the cluster with the nearest mean.

### Principal Component Analysis (PCA)

PCA is a dimensionality reduction technique that transforms high-dimensional data into a lower-dimensional space while preserving as much variance as possible.

## Neural Networks and Deep Learning

Neural networks are computing systems inspired by the biological neural networks in animal brains.

### Components of Neural Networks

- **Neurons**: Basic computational units
- **Layers**: Input layer, hidden layers, and output layer
- **Weights and Biases**: Parameters adjusted during training
- **Activation Functions**: Functions that determine the output of a neuron (e.g., ReLU, sigmoid, tanh)

### Deep Learning

Deep learning is a subset of machine learning that uses neural networks with multiple layers (deep neural networks).

Popular deep learning architectures include:

- **Convolutional Neural Networks (CNNs)**: Primarily used for image processing tasks
- **Recurrent Neural Networks (RNNs)**: Designed for sequential data like time series or natural language
- **Transformers**: Architecture that has revolutionized natural language processing

## Model Evaluation

Evaluating machine learning models is crucial to ensure they perform well on unseen data.

Common evaluation metrics include:

- **Accuracy**: Percentage of correct predictions
- **Precision**: Ratio of true positives to all predicted positives
- **Recall**: Ratio of true positives to all actual positives
- **F1 Score**: Harmonic mean of precision and recall
- **ROC Curve and AUC**: Plots true positive rate against false positive rate 