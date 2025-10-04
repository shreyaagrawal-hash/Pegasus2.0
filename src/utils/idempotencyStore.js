const processedRequests = new Set();

const add = (key) => {
  processedRequests.add(key);
};

const has = (key) => {
  return processedRequests.has(key);
};

const clear = () => {
    processedRequests.clear();
}

module.exports = {
  add,
  has,
  clear,
};
