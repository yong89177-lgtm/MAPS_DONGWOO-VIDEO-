// 데모/소규모 운영용 간단한 키 인증. 헤더(x-admin-key) 또는 쿼리(?key=)로 전달받는다.
module.exports = function adminAuth(req, res, next) {
  const key = req.header('x-admin-key') || req.query.key;
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ message: '관리자 인증이 필요합니다.' });
  }
  next();
};
